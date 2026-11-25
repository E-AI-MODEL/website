// Browservertaling zonder Chrome Translator. Geïsoleerde worker zodat de UI blijft reageren.
export function createBrowserTranslator(onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    let worker;
    try { worker = new Worker(new URL('./translation-worker.js', import.meta.url), {type:'module'}); }
    catch (e) { reject(e); return; }
    let ready = false;
    let disposed = false;
    let id = 0;
    const pending = new Map();
    const initTimeout = setTimeout(() => {
      if (!ready) {
        worker.terminate();
        reject(new Error('Vertaalmodel reageert niet na drie minuten. Controleer wifi en geheugen.'));
      }
    }, 180000);
    function fail(error) {
      clearTimeout(initTimeout);
      worker.terminate();
      disposed = true;
      const err = error instanceof Error ? error : new Error(String(error));
      if (!ready) reject(err);
      for (const item of pending.values()) { clearTimeout(item.timer); item.reject(err); }
      pending.clear();
    }
    worker.onerror = e => {
      e.preventDefault?.();
      fail(new Error(e.message || 'Vertaalworker kon niet starten'));
    };
    worker.onmessage = ({data}) => {
      if (!data || disposed) return;
      if (data.type === 'progress') {
        onProgress(data.message || 'Vertaalmodel laden…');
        return;
      }
      if (data.type === 'ready') {
        clearTimeout(initTimeout);
        ready = true;
        resolve({
          kind:'onnx',
          translate(text) {
            if (disposed) return Promise.reject(new Error('Vertaalworker is gestopt'));
            const key = ++id;
            return new Promise((resolveTranslation, rejectTranslation) => {
              const timer = setTimeout(() => {
                pending.delete(key);
                rejectTranslation(new Error('Vertaling duurt langer dan 40 seconden'));
              },40000);
              pending.set(key,{resolve:resolveTranslation,reject:rejectTranslation,timer});
              worker.postMessage({type:'translate',id:key,text:String(text)});
            });
          },
          dispose() { fail(new Error('Vertaalmodel afgesloten')); }
        });
        return;
      }
      if (data.type === 'fatal') { fail(new Error(data.error || 'Vertaalmodel mislukt')); return; }
      if (data.type === 'result' || data.type === 'error') {
        const item = pending.get(data.id);
        if (!item) return;
        clearTimeout(item.timer);
        pending.delete(data.id);
        if (data.type === 'result') item.resolve(data.text);
        else item.reject(new Error(data.error || 'Vertaling mislukt'));
      }
    };
    worker.postMessage({type:'init'});
  });
}
