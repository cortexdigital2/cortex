// Exportar Word
export async function exportarWord({ pergunta, lobos, veredicto }) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          text: 'Córtex Digital — Relatório',
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Pergunta: ', bold: true }),
            new TextRun(pergunta),
          ]
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
          text: 'Respostas dos Lobos',
          heading: HeadingLevel.HEADING_2,
        }),
        ...lobos.map(lobe => [
          new Paragraph({
            text: lobe.nome,
            heading: HeadingLevel.HEADING_3,
          }),
          new Paragraph({ text: lobe.resposta || '[sem resposta]' }),
          new Paragraph({ text: '' }),
        ]).flat(),
        new Paragraph({
          text: 'Veredicto do Rei',
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({ text: veredicto || '[sem veredicto]' }),
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  descarregarFicheiro(blob, 'cortex-relatorio.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}

// Exportar Excel
export async function exportarExcel({ pergunta, lobos, veredicto }) {
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Córtex');

  ws.addRow(['Pergunta', pergunta]);
  ws.addRow([]);
  ws.addRow(['Lobo', 'Resposta', 'Modelo', 'Confiança']);
  lobos.forEach(l => {
    ws.addRow([
      l.nome,
      l.resposta || '[sem resposta]',
      l.modelo || '',
      l.confianca != null ? `${l.confianca}%` : '',
    ]);
  });
  ws.addRow([]);
  ws.addRow(['Veredicto do Rei', veredicto || '[sem veredicto]']);

  ws.getColumn(1).width = 20;
  ws.getColumn(2).width = 80;
  ws.getColumn(3).width = 30;
  ws.getColumn(4).width = 12;

  const buffer = await wb.xlsx.writeBuffer();
  descarregarFicheiro(buffer, 'cortex-relatorio.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

// Exportar Notion (via proxy sem servidor)
export async function exportarNotion({ pergunta, lobos, veredicto, notionToken, notionPageId }) {
  if (!notionToken || !notionPageId) {
    throw new Error('Notion: token e ID da página necessários');
  }

  const resposta = await fetch('/api/notion-export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pergunta, lobos, veredicto, notionToken, notionPageId })
  });

  if (!resposta.ok) throw new Error('Exportação para Notion falhou');
  return resposta.json();
}

// Auxiliar interno
function descarregarFicheiro(blob, nome, tipo) {
  const url = URL.createObjectURL(new Blob([blob], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export default { exportarWord, exportarExcel, exportarNotion };
