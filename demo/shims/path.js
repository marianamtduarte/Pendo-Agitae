export const join = (...p) => p.filter(Boolean).join('/').replace(/\/+/g, '/');
export const resolve = join;
export const dirname = (p) => p.replace(/\/[^/]*$/, '') || '/';
export const basename = (p) => p.split('/').pop();
export const extname = (p) => (/\.[^./]+$/.exec(p) || [''])[0];
export default { join, resolve, dirname, basename, extname };
