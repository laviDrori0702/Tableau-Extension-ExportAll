import XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Declare this so our linter knows that tableau is a global object
/* global tableau */


//array_move function from stackoverflow solution:
//https://stackoverflow.com/questions/5306680/move-an-array-element-from-one-array-position-to-another
function array_move(arr, old_index, new_index) {
  if (new_index >= arr.length) {
      var k = new_index - arr.length + 1;
      while (k--) {
          arr.push(undefined);
      }
  }
  arr.splice(new_index, 0, arr.splice(old_index, 1)[0]);
  return arr; // for testing
};

const saveSettings = () => new Promise((resolve, reject) => {
  console.log('[func.js] Saving settings');
  tableau.extensions.settings.set('metaVersion', 2);
  console.log('[func.js] Authoring mode', tableau.extensions.environment.mode);
  if (tableau.extensions.environment.mode === "authoring") {
    tableau.extensions.settings.saveAsync()
    .then(newSavedSettings => {
      //console.log('[func.js] newSavedSettings', newSavedSettings);
      resolve(newSavedSettings);
    }).catch(reject);
  } else {
    resolve();
  }
  
});

const setSettings = (type, value) => new Promise((resolve, reject) => {
  console.log('[func.js] Set settings', type, value);
  let settingKey = '';
  switch(type) {
    case 'sheets':
      settingKey = 'selectedSheets';
      break;
    case 'label':
      settingKey = 'buttonLabel';
      break;
    case 'style':
      settingKey = 'buttonStyle';
      break;
    case 'filename':
      settingKey = 'filename';
      break;
    case 'version':
      settingKey = 'metaVersion';
      break;
    default:
      settingKey = 'unknown';
  }
  tableau.extensions.settings.set(settingKey, JSON.stringify(value));
  resolve();
});

const getSheetColumns = (sheet, existingCols, modified) => new Promise((resolve, reject) => {
  sheet.getSummaryDataAsync({ignoreSelection: true}).then((data) => {
    //console.log('[func.js] Sheet Summary Data', data);
    console.log('[func.js] getSheetColumns existingCols', JSON.stringify(existingCols));
    const columns = data.columns;
    let cols = [];
    const existingIdx = [];
    if (modified) {
      for (var j = 0; j < columns.length; j++) {
        //console.log(columns[j]);
        var col = {};
        col.index = columns[j].index;
        col.name = columns[j].fieldName;
        col.dataType = columns[j].dataType;
        col.changeName = null;
        col.selected = false;
        cols.push(col);
      }
      for (var i = 0; i < existingCols.length; i++) {
        if (existingCols[i] && existingCols[i].hasOwnProperty("name")) {
          existingIdx.push(existingCols[i].name);
        }
      }
      console.log('[func.js] getSheetColumns existingIdx', existingIdx);
      let maxPos = existingIdx.length;
      cols = cols.map((col, idx) => {
        //console.log('[func.js] getSheetColumns Looking for col', col);
        const eIdx = existingIdx.indexOf(col.name);
        const ret = {...col};
        if (eIdx > -1) {
          ret.selected = existingCols[eIdx].selected;
          ret.changeName = existingCols[eIdx].changeName;
          ret.order = eIdx;
        } else {
          ret.order = maxPos;
          maxPos += 1;
        }
        return ret;
      });
    } else {
      for (var k = 0; k < columns.length; k++) {
        var newCol = {};
        newCol.index = columns[k].index;
        newCol.name = columns[k].fieldName;
        newCol.dataType = columns[k].dataType;
        newCol.selected = true;
        newCol.order = k + 1;
        cols.push(newCol);
      }
    }
    cols = cols.sort((a, b) => (a.order > b.order) ? 1 : -1)
    resolve(cols);
  })
  .catch(error => {
    console.log('[func.js] Error with getSummaryDataAsync', sheet, error);
    reject(error);
  });
});

const initializeMeta = () => new Promise((resolve, reject) => {
  console.log('[func.js] Initialise Meta');
  var promises = [];
  const worksheets = tableau.extensions.dashboardContent._dashboard.worksheets;
  //console.log('[func.js] Worksheets in dashboard', worksheets);
  var meta = worksheets.map(worksheet => {
    var sheet = worksheet;
    var item = {};
    item.sheetName = sheet.name;
    item.selected = false;
    item.changeName = null;
    item.customCols = false;
    promises.push(getSheetColumns(sheet, null, false));
    return item;
  });

  console.log(`[func.js] Found ${meta.length} sheets`, meta);

  Promise.all(promises).then((sheetArr) => {
    for (var i = 0; i < sheetArr.length; i++) {
      var sheetMeta = meta[i];
      sheetMeta.columns = sheetArr[i];
      meta[i] = sheetMeta;
      console.log(`[func.js] Added ${sheetArr[i].length} columns to ${sheetMeta.sheetName}`, meta);
    }
    //console.log(`[func.js] Meta initialised`, meta);
    resolve(meta);
  });
});

const revalidateMeta = (existing) => new Promise((resolve, reject) => {
  console.log('[func.js] Revalidate Meta');
  var promises = [];
  const worksheets = tableau.extensions.dashboardContent._dashboard.worksheets;
  //console.log('[func.js] Worksheets in dashboard', worksheets);
  var meta = worksheets.map(worksheet => {
    var sheet = worksheet;
    const sheetIdx = existing.findIndex((e) => {
      return e.sheetName === sheet.name;
    });
    if (sheetIdx > -1) {
      console.log(`[func.js] Existing sheet ${sheet.name} columns`, JSON.stringify(existing[sheetIdx].columns));
      promises.push(getSheetColumns(sheet, existing[sheetIdx].columns, true));
      existing[sheetIdx].existed = true;
      return existing[sheetIdx];
    } else {
      var item = {};
      item.sheetName = sheet.name;
      item.selected = false;
      item.changeName = null;
      item.customCols = false;
      item.existed = false;
      promises.push(getSheetColumns(sheet, null, false));
      return item;
    }
  });

  console.log(`[func.js] Found ${meta.length} sheets`, meta);

  Promise.all(promises).then((sheetArr) => {

    for (var i = 0; i < sheetArr.length; i++) {
      var sheetMeta = meta[i];
      sheetMeta.columns = sheetArr[i];
      meta[i] = sheetMeta;
      //console.log(`[func.js] Added ${sheetArr[i].length} columns to ${sheetMeta.sheetName}`, meta);
    }
    meta.forEach((sheet, idx) => {
      if (sheet && sheet.sheetName) {
        const eIdx = existing.findIndex((e) => {
          return e.sheetName === sheet.sheetName;
        });
        meta = array_move(meta, idx, eIdx);
      } else {
        console.log('[func.js] Sheet ordering issue. No sheet defined in idx', idx);
      }
    })
    console.log(`[func.js] Meta revalidated`, JSON.stringify(meta));
    resolve(meta);
  });
});

const exportToExcel = (meta, env, filename) => {
  let xlsFile = "export.xlsx";
  if (filename && filename.length > 0) {
    xlsFile = filename + ".xlsx";
  }
  return buildExcelBlob(meta).then(wb => {
    // add ignoreEC:false to prevent excel crashes during text to column
    var wopts = { bookType:'xlsx', bookSST:false, type:'array', ignoreEC:false };
    var wbout = XLSX.write(wb,wopts);
    saveAs(new Blob([wbout],{type:"application/octet-stream"}), xlsFile);
  });
};



// krisd: move excel creation to caller (to support extra export to methodss)
// callback receives a blob to save or transfer
const buildExcelBlob = (meta) => {
  console.log("[func.js] Got Meta", meta);
  const worksheets = tableau.extensions.dashboardContent.dashboard.worksheets;
  const selected = meta.filter(sheetMeta => sheetMeta && sheetMeta.selected);

  // Promise.all, not a completion counter: a rejected getSummaryDataAsync used to
  // leave the count short of the total, so this promise never settled and the export
  // silently hung. Awaiting in order also keeps tab/column order as configured.
  return Promise.all(selected.map(sheetMeta => {
    const sheet = worksheets.find(s => s.name === sheetMeta.sheetName);
    if (!sheet) {
      return Promise.reject(new Error(`Sheet not found in dashboard: ${sheetMeta.sheetName}`));
    }
    return buildWorksheet(sheet, sheetMeta.columns);
  })).then(sheets => {
    const wb = XLSX.utils.book_new();
    sheets.forEach((ws, idx) => {
      const tabName = (selected[idx].changeName || selected[idx].sheetName).replace(/[*?/\\[\]]/gi, '');
      XLSX.utils.book_append_sheet(wb, ws, tabName);
    });
    return wb;
  });
};

// One sheet's summary data -> one XLSX worksheet
const buildWorksheet = (sheet, columnMeta) => (
  sheet.getSummaryDataAsync({ignoreSelection: true}).then((data) => {
    const headerOrder = columnMeta
      .filter(colMeta => colMeta && colMeta.selected)
      .map(colMeta => colMeta.changeName || colMeta.name);
    // New array rather than mutating Tableau's; the spread keeps _dataType, which
    // decodeRow reads.
    const columns = data.columns.map(column => {
      const objCol = columnMeta.find(o => o && o.name === column.fieldName);
      if (!objCol) {
        return { ...column, selected: false };
      }
      return { ...column, selected: objCol.selected, outputName: objCol.changeName || objCol.name };
    });
    console.log("[func.js] Header Order", headerOrder);
    return decodeDataset(columns, data.data)
      .then(rows => XLSX.utils.json_to_sheet(rows, {header: headerOrder}));
  })
);


// krisd: Remove recursion to work with larger data sets
// and translate cell data types
const decodeDataset = (columns, dataset) => new Promise((resolve, reject) => {
  let promises = [];
  for (let i=0; i<dataset.length; i++) {
    promises.push(decodeRow(columns, dataset[i]));
  }
  Promise.all(promises).then((datasetArr) => {
    //console.log('[func.js] datasetArr', datasetArr);
    resolve(datasetArr);
  });

});

const decodeRow = (columns, row) => new Promise((resolve, reject) => {
  let meta = {};
  for (let j = 0; j < columns.length; j++) {
    if (columns[j].selected) {
      // krisd: let's assign the sheetjs type according to the summary data column type
      let dtype = undefined;
      let dval = undefined;
      // console.log('[func.js] Row', row[j]);
      if (row[j].value === '%null%' && row[j].nativeValue === null && row[j].formattedValue === 'Null') {
        dtype = 'z';
        dval = null;
      } else {
        switch (columns[j]._dataType) {
          case 'int':
          case 'float':
            dtype = 'n';
            dval = Number(row[j].value);  // let nums be raw w/o formatting
            if (isNaN(dval)) dval = row[j].formattedValue;  // protect in case issue
            break;
          case 'date':
          case 'date-time':
            dtype = 's';
            dval = row[j].formattedValue;
            break;
          case 'bool':
            dtype = 'b';
            dval = row[j].value;
            break;
          default:
            dtype = 's';
            dval = row[j].formattedValue;
        }
      }
      let o = {v:dval, t:dtype};
      meta[columns[j].outputName] = o;
    }
  }
  resolve(meta);
});



export {
  initializeMeta,
  revalidateMeta,
  saveSettings,
  setSettings,
  exportToExcel,
}
