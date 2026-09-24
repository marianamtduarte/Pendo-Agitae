// node:fs não existe no navegador; estas funções só são chamadas em caminhos que a demo não usa.
const no = () => { throw new Error('Sistema de arquivos indisponível na demonstração online.'); };
export const writeFileSync = no, mkdirSync = () => {}, rmSync = () => {}, readFileSync = no, readdirSync = () => [], statSync = no, createReadStream = no;
export default { writeFileSync, mkdirSync, rmSync, readFileSync, readdirSync, statSync, createReadStream };
