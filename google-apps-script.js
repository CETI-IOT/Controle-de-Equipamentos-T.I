/**
 * ==============================================================================
 * SISTEMA DE CONTROLE DE EQUIPAMENTOS TI - BACKEND GOOGLE SHEETS
 * ==============================================================================
 * Instruções de instalação:
 * 1. Crie uma nova planilha no Google Sheets (planilhas.google.com).
 * 2. Clique no menu superior: "Extensões" > "Apps Script".
 * 3. Apague todo o conteúdo do editor e cole este script na íntegra.
 * 4. Salve o projeto (Ctrl + S).
 * 5. Clique no botão azul no topo: "Implantar" > "Nova Implantação".
 * 6. Na engrenagem ao lado de "Selecione o tipo", escolha "App da Web".
 * 7. Configure:
 *    - Descrição: API Controle Equipamentos
 *    - Executar como: "Eu (seu email)"
 *    - Quem pode acessar: "Qualquer pessoa" (MUITO IMPORTANTE!)
 * 8. Clique em "Implantar", conceda as permissões solicitadas pela sua conta Google.
 * 9. Copie o "URL do app da web" gerado e cole nas configurações do aplicativo HTML!
 * ==============================================================================
 */

const SHEET_MOVIMENTACOES = "Movimentacoes";
const SHEET_INVENTARIO = "Inventario";
const SHEET_COLABORADORES = "Colaboradores";

/**
 * Responde a requisições GET (Consulta de dados)
 */
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. Inicializa abas se não existirem
    const sheetMov = getOrCreateSheet(ss, SHEET_MOVIMENTACOES, [
      "ID", "Código", "Equipamento", "Solicitante", "Data Retirada", "Data Devolução", "Status", "Observações"
    ]);
    
    const sheetInv = getOrCreateSheet(ss, SHEET_INVENTARIO, [
      "Código", "Descrição", "Categoria", "Número de Série", "Status"
    ]);

    const sheetColab = getOrCreateSheet(ss, SHEET_COLABORADORES, [
      "Matrícula", "Nome", "Setor", "Email"
    ]);

    // 2. Lê os dados de cada aba
    const records = getSheetDataAsJson(sheetMov);
    const inventory = getSheetDataAsJson(sheetInv);
    const employees = getSheetDataAsJson(sheetColab);

    const response = {
      status: "success",
      timestamp: new Date().toISOString(),
      records: records,
      inventory: inventory,
      employees: employees
    };

    return createJsonResponse(response);

  } catch (error) {
    return createJsonResponse({
      status: "error",
      message: error.toString()
    });
  }
}

/**
 * Responde a requisições POST (Criação, Atualização, Exclusão)
 */
function doPost(e) {
  try {
    let payload;
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else {
      payload = e.parameter;
    }

    const action = payload.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetMov = getOrCreateSheet(ss, SHEET_MOVIMENTACOES, [
      "ID", "Código", "Equipamento", "Solicitante", "Data Retirada", "Data Devolução", "Status", "Observações"
    ]);
    const sheetInv = getOrCreateSheet(ss, SHEET_INVENTARIO, [
      "Código", "Descrição", "Categoria", "Número de Série", "Status"
    ]);

    // --- AÇÃO 1: CRIAR NOVA RETIRADA / MOVIMENTAÇÃO ---
    if (action === "create") {
      sheetMov.appendRow([
        payload.id || Date.now(),
        payload.code || "",
        payload.desc || "",
        payload.requester || "",
        payload.withdrawalDate || "",
        payload.returnDate || "",
        payload.status || "Emprestado",
        payload.obs || ""
      ]);

      // Atualiza status no inventário se cadastrado
      updateInventoryItemStatus(sheetInv, payload.code, "Emprestado");

      return createJsonResponse({ status: "success", message: "Movimentação registrada com sucesso!" });
    }

    // --- AÇÃO 2: REGISTRAR DEVOLUÇÃO ---
    if (action === "return") {
      const data = sheetMov.getDataRange().getValues();
      let found = false;

      for (let i = 1; i < data.length; i++) {
        const rowId = String(data[i][0]);
        const rowCode = String(data[i][1]).trim().toLowerCase();
        const rowStatus = String(data[i][6]);

        const matchById = payload.id && rowId === String(payload.id);
        const matchByCode = payload.code && rowCode === String(payload.code).trim().toLowerCase() && rowStatus === "Emprestado";

        if (matchById || matchByCode) {
          const rowNum = i + 1;
          const returnDate = payload.returnDate || new Date().toLocaleString("pt-BR");
          
          sheetMov.getRange(rowNum, 6).setValue(returnDate); // Coluna F: Data Devolução
          sheetMov.getRange(rowNum, 7).setValue("Devolvido");   // Coluna G: Status

          if (payload.obs) {
            const currentObs = sheetMov.getRange(rowNum, 8).getValue();
            const newObs = currentObs ? `${currentObs} | Dev: ${payload.obs}` : `Dev: ${payload.obs}`;
            sheetMov.getRange(rowNum, 8).setValue(newObs);
          }

          // Atualiza status no inventário de volta para Disponível
          updateInventoryItemStatus(sheetInv, data[i][1], "Disponível");

          found = true;
          break;
        }
      }

      if (found) {
        return createJsonResponse({ status: "success", message: "Devolução confirmada com sucesso!" });
      } else {
        return createJsonResponse({ status: "not_found", message: "Empréstimo em aberto não localizado para este equipamento." });
      }
    }

    // --- AÇÃO 3: EXCLUIR REGISTRO ---
    if (action === "delete") {
      const data = sheetMov.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(payload.id)) {
          sheetMov.deleteRow(i + 1);
          return createJsonResponse({ status: "success", message: "Registro excluído com sucesso!" });
        }
      }
      return createJsonResponse({ status: "not_found", message: "Registro não encontrado." });
    }

    // --- AÇÃO 4: CADASTRAR OU ATUALIZAR ITEM NO INVENTÁRIO ---
    if (action === "saveEquipment") {
      const data = sheetInv.getDataRange().getValues();
      let updated = false;

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).toLowerCase() === String(payload.code).trim().toLowerCase()) {
          const rowNum = i + 1;
          sheetInv.getRange(rowNum, 2).setValue(payload.desc || data[i][1]);
          sheetInv.getRange(rowNum, 3).setValue(payload.category || data[i][2]);
          sheetInv.getRange(rowNum, 4).setValue(payload.serialNumber || data[i][3]);
          sheetInv.getRange(rowNum, 5).setValue(payload.status || data[i][4]);
          updated = true;
          break;
        }
      }

      if (!updated) {
        sheetInv.appendRow([
          payload.code,
          payload.desc || "",
          payload.category || "Equipamento",
          payload.serialNumber || "",
          payload.status || "Disponível"
        ]);
      }

      return createJsonResponse({ status: "success", message: "Equipamento salvo no inventário!" });
    }

    // --- AÇÃO 5: SINCRONIZAÇÃO EM LOTE (IMPORTAÇÃO / OFFLINE BATCH) ---
    if (action === "batchSync") {
      if (Array.isArray(payload.records)) {
        payload.records.forEach(r => {
          sheetMov.appendRow([
            r.id || Date.now(),
            r.code || "",
            r.desc || "",
            r.requester || "",
            r.withdrawalDate || "",
            r.returnDate || "",
            r.status || "Emprestado",
            r.obs || ""
          ]);
        });
      }
      return createJsonResponse({ status: "success", message: "Sincronização em lote concluída!" });
    }

    return createJsonResponse({ status: "error", message: "Ação não reconhecida: " + action });

  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  }
}

/**
 * Utilitário: Cria aba com cabeçalho formatado se ela ainda não existir
 */
function getOrCreateSheet(spreadsheet, sheetName, headers) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    sheet.appendRow(headers);
    
    // Formata o cabeçalho
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#4338CA"); // Indigo-700
    headerRange.setFontColor("#FFFFFF");
    headerRange.setFontWeight("bold");
    sheet.setFrozenRows(1);
    
    // Ajusta largura mínima das colunas
    for (let c = 1; c <= headers.length; c++) {
      sheet.setColumnWidth(c, 160);
    }
  }
  return sheet;
}

/**
 * Utilitário: Lê todas as linhas de uma aba e converte para Array de Objetos JSON
 */
function getSheetDataAsJson(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const rows = data.slice(1);

  return rows.map(row => {
    let item = {};
    headers.forEach((header, index) => {
      // Mapeia nomes amigáveis para chaves camelCase no JSON
      const key = normalizeHeaderKey(header);
      let val = row[index];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
      }
      item[key] = val;
    });
    return item;
  });
}

/**
 * Normaliza os títulos das colunas para chaves do objeto JSON
 */
function normalizeHeaderKey(header) {
  const map = {
    "ID": "id",
    "Código": "code",
    "Codigo": "code",
    "Equipamento": "desc",
    "Descrição": "desc",
    "Descricao": "desc",
    "Solicitante": "requester",
    "Data Retirada": "withdrawalDate",
    "Data Devolução": "returnDate",
    "Data Devolucao": "returnDate",
    "Status": "status",
    "Observações": "obs",
    "Observacoes": "obs",
    "Categoria": "category",
    "Número de Série": "serialNumber",
    "Matrícula": "id",
    "Nome": "name",
    "Setor": "department",
    "Email": "email"
  };
  return map[header] || header.toString().toLowerCase().replace(/\s+/g, "_");
}

/**
 * Atualiza o status de um item específico na aba de Inventário
 */
function updateInventoryItemStatus(sheetInv, code, newStatus) {
  if (!code) return;
  const data = sheetInv.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === String(code).trim().toLowerCase()) {
      sheetInv.getRange(i + 1, 5).setValue(newStatus);
      break;
    }
  }
}

/**
 * Retorna saída de texto com formato JSON e cabeçalho adequado
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Adiciona menu customizado na barra de ferramentas do Google Planilhas
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('🛠️ Controle TI')
      .addItem('🚀 Configurar / Estruturar Planilha Completa', 'setupPlanilhaCompleta')
      .addItem('✅ Testar Conexão do Script', 'testarScript')
      .addToUi();
  } catch (e) {
    // Modo Web App pode ignorar se não estiver em contexto interativo
  }
}

function testarScript() {
  SpreadsheetApp.getUi().alert(
    '✅ Script Ativo e Conectado!\n\n' +
    'Para conectar este Google Sheets ao seu sistema Web:\n' +
    '1. Clique em "Implantar" > "Nova Implantação" no topo do Apps Script.\n' +
    '2. Escolha "App da Web", defina "Quem pode acessar: Qualquer pessoa".\n' +
    '3. Copie o URL final e cole no seu sistema index.html!'
  );
}

/**
 * CONFIGURAÇÃO AUTOMÁTICA EM 1 CLIQUE:
 * Cria todas as abas, estiliza cabeçalhos em Índigo, insere dados de exemplo e remove abas vazias.
 */
function setupPlanilhaCompleta() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Cria ou formata aba Movimentacoes
  const sheetMov = getOrCreateSheet(ss, SHEET_MOVIMENTACOES, [
    "ID", "Código", "Equipamento", "Solicitante", "Data Retirada", "Data Devolução", "Status", "Observações"
  ]);
  
  // 2. Cria ou formata aba Inventario
  const sheetInv = getOrCreateSheet(ss, SHEET_INVENTARIO, [
    "Código", "Descrição", "Categoria", "Número de Série", "Status"
  ]);

  // 3. Cria ou formata aba Colaboradores
  const sheetColab = getOrCreateSheet(ss, SHEET_COLABORADORES, [
    "Matrícula", "Nome", "Setor", "Email"
  ]);

  // Popula dados iniciais no Inventário se estiver vazio
  if (sheetInv.getLastRow() <= 1) {
    sheetInv.appendRow(["EQ-1001", "Notebook Dell Latitude 3420 i5 16GB", "Notebook", "SN-DELL-8831", "Disponível"]);
    sheetInv.appendRow(["EQ-1002", "Notebook Lenovo ThinkPad E14 Ryzen 7", "Notebook", "SN-LEN-4412", "Disponível"]);
    sheetInv.appendRow(["EQ-1003", "Monitor LG 24 polegadas IPS 75Hz", "Monitor", "SN-LG-9921", "Disponível"]);
    sheetInv.appendRow(["EQ-1004", "Kit Teclado + Mouse sem fio Dell KM3322W", "Periférico", "SN-ACC-1102", "Disponível"]);
    sheetInv.appendRow(["EQ-1005", "Adaptador USB-C para HDMI / VGA Dell", "Acessório", "SN-ADP-5521", "Disponível"]);
    sheetInv.appendRow(["EQ-1006", "Headset Jabra Evolve 20 USB", "Áudio", "SN-JAB-7733", "Disponível"]);
  }

  // Popula dados iniciais em Colaboradores se estiver vazio
  if (sheetColab.getLastRow() <= 1) {
    sheetColab.appendRow(["101", "João Pedro Silva", "Desenvolvimento", "joao.silva@empresa.com"]);
    sheetColab.appendRow(["102", "Mariana Costa", "RH / Gente & Gestão", "mariana.costa@empresa.com"]);
    sheetColab.appendRow(["103", "Lucas Fernandes", "Financeiro", "lucas.fernandes@empresa.com"]);
    sheetColab.appendRow(["104", "Camila Rocha", "Operações", "camila.rocha@empresa.com"]);
  }

  // Remove aba padrão vazia ("Página1" ou "Sheet1")
  const defaultSheet = ss.getSheetByName("Página1") || ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }

  ss.setActiveSheet(sheetMov);
  ss.toast("Planilha 100% estruturada e configurada com sucesso!", "✅ Concluído", 6);
}


