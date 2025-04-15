function doPost(e) {
  try {
    // Parse the JSON data from the request
    const data = JSON.parse(e.postData.contents);
    
    // Get the active spreadsheet and sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();
    
    // Get current timestamp
    const timestamp = new Date();
    
    // If the sheet is empty, add headers
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Timestamp',
        'Driver Name',
        'Client Name',
        'Number of Carts',
        'Pounds'
      ]);
    }
    
    // Append the data to the sheet
    sheet.appendRow([
      timestamp,
      data.driverName,
      data.clientName,
      data.carts,
      data.pounds
    ]);
    
    // Return success response
    return ContentService.createTextOutput(JSON.stringify({
      'status': 'success',
      'message': 'Data added successfully'
    }))
    .setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    // Return error response
    return ContentService.createTextOutput(JSON.stringify({
      'status': 'error',
      'message': error.toString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
  }
} 