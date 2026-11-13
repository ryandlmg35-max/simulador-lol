/**
 * Converte o canvas em data URL preferindo WebP (bem menor que PNG e
 * mantém transparência). Fallback PNG quando o navegador não tem encoder
 * WebP — o prefixo do data URL denuncia qual formato saiu.
 */
function canvasToDataUrl(canvas: HTMLCanvasElement, quality?: number): string {
  try {
    const webp = canvas.toDataURL("image/webp", quality);
    if (webp.startsWith("data:image/webp")) return webp;
  } catch {
    /* sem encoder webp — cai no PNG */
  }
  return canvas.toDataURL("image/png");
}

/**
 * Lê uma imagem enviada e devolve um data URL COMPACTO (redimensionado para
 * no máximo `maxSize` px). Logos originais costumam ter centenas de KB — sem
 * compactar, o localStorage do navegador estoura a cota e os dados param de
 * ser salvos em silêncio.
 */
export function fileToLogo(file: File, maxSize = 128): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(result);
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvasToDataUrl(canvas, 0.82));
        } catch {
          resolve(result);
        }
      };
      img.onerror = () => resolve(result);
      img.src = result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Data URLs menores que isso não valem re-encode (ganho < ruído). */
const MIN_COMPRESS_BYTES = 6000;

/**
 * Comprime um data URL de logo JÁ SALVO (reduz para maxSize px, WebP q82).
 * Retorna o mesmo data URL se já for pequeno demais ou não for data URL.
 */
export async function compressExistingLogo(
  dataUrl: string,
  maxSize = 128,
  minBytes = MIN_COMPRESS_BYTES,
): Promise<string> {
  if (!dataUrl.startsWith("data:")) return dataUrl;
  if (dataUrl.length < minBytes) return dataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvasToDataUrl(canvas, 0.82));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export interface CompressResult<T> {
  value: T;
  saved: number;
}

/**
 * Varre uma estrutura ANY procurando data URLs de imagem ≥ MIN_COMPRESS_BYTES
 * e regrava cada um comprimido (WebP 128px). Logos repetidos são comprimidos
 * UMA vez (cache por string) — o mesmo time aparece em vários campeonatos e
 * no ranking de carreira, e o localStorage não deduplica. Usado pelo botão de
 * otimização e pela recuperação automática quando a cota estoura.
 */
export async function deepCompressLogos<T>(input: T): Promise<CompressResult<T>> {
  let saved = 0;
  const cache = new Map<string, string>();
  const walk = async (v: unknown): Promise<unknown> => {
    if (typeof v === "string") {
      if (!v.startsWith("data:image") || v.length < MIN_COMPRESS_BYTES) return v;
      let out = cache.get(v);
      if (out === undefined) {
        out = await compressExistingLogo(v, 128, MIN_COMPRESS_BYTES);
        cache.set(v, out);
      }
      if (out.length < v.length) saved += v.length - out.length;
      return out;
    }
    if (Array.isArray(v)) return Promise.all(v.map(walk));
    if (v && typeof v === "object") {
      const pairs = await Promise.all(
        Object.entries(v).map(async ([k, val]) => [k, await walk(val)] as const),
      );
      return Object.fromEntries(pairs);
    }
    return v;
  };
  const value = (await walk(input)) as T;
  return { value, saved };
}

/** Uso atual do localStorage em KB (aproximado). */
export function getStorageUsage(): { usedKB: number; limitKB: number; pct: number } {
  if (typeof window === "undefined") return { usedKB: 0, limitKB: 5120, pct: 0 };
  let total = 0;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key) total += (window.localStorage.getItem(key)?.length ?? 0) + key.length;
    }
  } catch {
    /* ignore */
  }
  const limitKB = 5120; // 5MB típico
  return { usedKB: Math.round(total / 1024), limitKB, pct: (total / 1024 / limitKB) * 100 };
}