import { Injectable, BadRequestException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import http from 'node:http';
import https from 'node:https';

type Materia = { id: string; sigla: string; nombre?: string; horario: string; modulo: string };
type DocenteHist = {
  docente: { id: string; nombres: string; ap_paterno?: string; ap_materno?: string };
  materias: Array<{ sigla: string; horario?: string; gestion?: string }>;
};
type FrontSinglePayload = { materia: Materia; docentes: DocenteHist[] };

@Injectable()
export class IaService {
  private base = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
  private model = process.env.OLLAMA_MODEL ?? 'gpt-oss:20b';
  private timeoutMs = +(process.env.OLLAMA_TIMEOUT_MS ?? 60_000);
  private topN = +(process.env.IA_TOP_N ?? 8);

  private httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
  private httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });
  private client: AxiosInstance = axios.create({
    timeout: this.timeoutMs,
    httpAgent: this.httpAgent,
    httpsAgent: this.httpsAgent,
    headers: { 'Content-Type': 'application/json' },
  });

  async sugerirAsignacionDocentes(data: FrontSinglePayload) {
    const { materia, docentes } = data ?? {};
    if (!materia?.id || !materia?.sigla) throw new BadRequestException('Faltan campos en "materia": id, sigla.');
    if (!Array.isArray(docentes) || docentes.length === 0) throw new BadRequestException('Lista "docentes" vacía.');

    const { prev1, prev2 } = this.lastTwoGestiones();
    const ventana = new Set([prev1, prev2]);

    const sigla = this.normSigla(materia.sigla);

    // 1) Rank: elegibles = impartieron en la VENTANA; score = vecesGlobal (histórico)
    const items = this.ranquearPorExperiencia(sigla, docentes, ventana);

    // Top N candidatos a enviar/mostrar
    const candidatos = items
      .slice(0, this.topN)
      .map(c => ({
        docente_id: String(c.docente.id),
        nombre: this.nombreCompleto(c.docente),
        vecesDictada: c.vecesGlobal,
        gestionReciente: c.gestionRecienteVentana,
        ultimaGestionGlobal: c.ultimaGestionGlobal,
        score: c.score, 
      }));

    if (candidatos.length === 0) {
      return { ok: true, best: null, candidatos: [] };
    }

    // 2) Payload mínimo para LLM (misma ventana, pero criterio = total histórico)
    const compact = {
      materia: { id: String(materia.id), sigla },
      ventana: [prev1, prev2],
      candidatos: candidatos.map(c => ({
        docente_id: c.docente_id,
        vecesDictada: c.vecesDictada,         
        gestionRecienteVentana: c.gestionReciente, 
      })),
    };

    const prompt =
      'Elige UN docente para esta sigla basándote SOLO en docentes que la dictaron en las gestiones de la "ventana".\n' +
      'Criterio principal: mayor CANTIDAD HISTÓRICA de veces dictada la MISMA SIGLA.\n' +
      'Desempate: gestión más reciente dentro de la ventana (YYYY-1/2).\n' +
      'Devuelve JSON ESTRICTO: {"best":{"materia_id":"...","docente_id":"...","razon":"..."}}\n' +
      JSON.stringify(compact);

    try {
      const { data: resp } = await this.client.post(
        `${this.base}/api/generate`,
        {
          model: this.model,
          prompt,
          stream: false,
          format: 'json',
          keep_alive: '5m',
          options: { temperature: 0, top_p: 0.5, num_ctx: 512, num_predict: 64 },
        }
      );

      const parsed = this.safeJson(resp?.response);
      let best = parsed?.best;

      if (!best?.materia_id || !best?.docente_id) {
        const first = candidatos[0];
        best = {
          materia_id: String(materia.id),
          docente_id: first.docente_id,
          razon: `Top-1 por total histórico en ${sigla} (ventana ${prev1}, ${prev2}): ${first.vecesDictada} veces · última ventana ${first.gestionReciente ?? 's/d'}`,
        };
      } else {
        best = {
          materia_id: String(best.materia_id),
          docente_id: String(best.docente_id),
          razon: String(best.razon ?? ''),
        };
      }

      return { ok: true, best, candidatos };
    } catch {
      const first = candidatos[0];
      return {
        ok: true,
        best: first
          ? {
              materia_id: String(materia.id),
              docente_id: first.docente_id,
              razon: `Top-1 histórico (fallback) en ventana ${prev1}, ${prev2}: ${first.vecesDictada} veces · última ventana ${first.gestionReciente ?? 's/d'}`,
            }
          : null,
        candidatos,
      };
    }
  }

  // ===== Helpers de gestión =====
  private currentGestion(d = new Date()) {
    const year = d.getFullYear();
    const month = d.getMonth();
    const sem = month <= 5 ? 1 : 2; 
    return `${year}-${sem}`;
  }
  private stepBack(gestion: string) {
    const m = /^(\d{4})-(1|2)$/.exec(gestion);
    if (!m) return null;
    let year = parseInt(m[1], 10);
    let sem = parseInt(m[2], 10);
    if (sem === 2) sem = 1;
    else { sem = 2; year -= 1; }
    return `${year}-${sem}`;
  }
  private lastTwoGestiones() {
    const curr = this.currentGestion();
    const prev1 = this.stepBack(curr)!;
    const prev2 = this.stepBack(prev1)!;
    return { curr, prev1, prev2 };
  }

  // ===== Helpers generales =====
  private normSigla(s?: string) { return (s ?? '').toUpperCase().trim().replace(/\s+/g, ''); }
  private nombreCompleto(d: DocenteHist['docente']) { return [d.nombres, d.ap_paterno, d.ap_materno].filter(Boolean).join(' ').trim(); }
  private gestionToNumber(g?: string | null) {
    if (!g) return null;
    const m = /^(\d{4})-(1|2)$/.exec(g.trim());
    if (!m) return null;
    const year = parseInt(m[1], 10);
    const sem = parseInt(m[2], 10);
    return year * 10 + sem; 
  }
  private maxGestion(gestiones: string[]) {
    let best: { g: string; n: number } | null = null;
    for (const g of gestiones) {
      const n = this.gestionToNumber(g);
      if (n == null) continue;
      if (!best || n > best.n) best = { g, n };
    }
    return best?.g ?? null;
  }

  private ranquearPorExperiencia(siglaObjetivo: string, docentes: DocenteHist[], ventana: Set<string>) {
    const items: Array<{
      docente: DocenteHist['docente'];
      vecesGlobal: number;
      vecesVentana: number;
      gestionRecienteVentana: string | null;
      ultimaGestionGlobal: string | null;
      score: number;
    }> = [];

    for (const d of docentes) {
      const allMatches = (d.materias || []).filter(m => this.normSigla(m.sigla) === siglaObjetivo);

      const vecesGlobal = allMatches.length;
      if (vecesGlobal === 0) continue; 

      const windowMatches = allMatches.filter(m => m.gestion && ventana.has(m.gestion));
      const vecesVentana = windowMatches.length;
      if (vecesVentana === 0) continue; 

      const gestionRecienteVentana = this.maxGestion(windowMatches.map(m => m.gestion!).filter(Boolean) as string[]);
      const ultimaGestionGlobal = this.maxGestion(allMatches.map(m => m.gestion).filter(Boolean) as string[]);

      const score = vecesGlobal;

      items.push({
        docente: d.docente,
        vecesGlobal,
        vecesVentana,
        gestionRecienteVentana,
        ultimaGestionGlobal,
        score,
      });
    }

    return items.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const nb = this.gestionToNumber(b.gestionRecienteVentana) ?? 0;
      const na = this.gestionToNumber(a.gestionRecienteVentana) ?? 0;
      if (nb !== na) return nb - na;
      const gb = this.gestionToNumber(b.ultimaGestionGlobal) ?? 0;
      const ga = this.gestionToNumber(a.ultimaGestionGlobal) ?? 0;
      return gb - ga;
    });
  }

  private safeJson(text?: string) {
    if (!text) return null;
    let t = text.trim();
    const s = t.indexOf('{'); const e = t.lastIndexOf('}');
    if (s >= 0 && e > s) t = t.slice(s, e + 1);
    try { return JSON.parse(t); } catch { return null; }
  }
}
