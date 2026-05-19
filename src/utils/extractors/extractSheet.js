// extractSheet.js — extrai conteúdo de ficheiros CSV e XLSX com SheetJS
import * as XLSX from 'exceljs'; // TODO: API diferente, requer refactor

/**
 * Extrai conteúdo de ficheiro CSV ou XLSX como texto legível.
 * Cada folha é separada por linha vazia com cabeçalho.
 * @param {File} file — ficheiro CSV ou XLSX
 * @returns {Promise<string>} texto tabulado de todas as folhas
 */
export async function extrairSheet(file) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  const partes = workbook.SheetNames.map(nomeFolha => {
    const folha = workbook.Sheets[nomeFolha];
    const csv = XLSX.utils.sheet_to_csv(folha, { skipHidden: true });
    return `[Folha: ${nomeFolha}]\n${csv.trim()}`;
  });

  return partes.join('\n\n');
}
