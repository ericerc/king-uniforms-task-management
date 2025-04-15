// IMPORTANT: Replace this with your Firebase service account credentials
// Store your actual credentials securely and never commit them to version control
// You can get these credentials from the Firebase Console:
// 1. Go to Project Settings
// 2. Go to Service Accounts tab
// 3. Click "Generate New Private Key"
const serviceAccount = {
  "type": "service_account",
  "project_id": "YOUR_PROJECT_ID",
  "private_key_id": "YOUR_PRIVATE_KEY_ID",
  "private_key": "YOUR_PRIVATE_KEY",
  "client_email": "YOUR_CLIENT_EMAIL",
  "client_id": "YOUR_CLIENT_ID",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "YOUR_CERT_URL",
  "universe_domain": "googleapis.com"
};

function syncFirebaseToSheet() {
  const sheet = SpreadsheetApp.getActiveSheet();
  
  // Clear existing data (except headers)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 5).clear();
  }
  
  // Set up headers if they don't exist
  if (sheet.getRange("A1").getValue() === "") {
    sheet.getRange("A1:E1").setValues([["Timestamp", "Driver Name", "Client Name", "Carts", "Pounds"]]);
    sheet.getRange("A1:E1").setFontWeight("bold");
  }
  
  try {
    // Create the URL for the Firestore REST API
    const projectId = serviceAccount.project_id;
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/driverEntries`;
    
    // Get an access token
    const accessToken = getOAuthToken();
    
    // Fetch the data
    const response = UrlFetchApp.fetch(baseUrl, {
      headers: {
        'Authorization': 'Bearer ' + accessToken
      }
    });
    
    const data = JSON.parse(response.getContentText());
    
    if (data.documents) {
      const entries = data.documents.map(doc => {
        const fields = doc.fields;
        return [
          new Date(fields.timestamp.timestampValue).toLocaleString(),
          fields.driverName.stringValue,
          fields.clientName.stringValue,
          fields.carts.stringValue,
          fields.pounds.stringValue
        ];
      });
      
      // Sort entries by timestamp (newest first)
      entries.sort((a, b) => new Date(b[0]) - new Date(a[0]));
      
      // Write to sheet
      if (entries.length > 0) {
        sheet.getRange(2, 1, entries.length, 5).setValues(entries);
      }
    }
  } catch (error) {
    Logger.log('Error: ' + error);
    throw new Error('Failed to sync data: ' + error);
  }
}

function getOAuthToken() {
  const privateKey = serviceAccount.private_key;
  const clientEmail = serviceAccount.client_email;
  
  const jwtHeader = {
    "alg": "RS256",
    "typ": "JWT"
  };
  
  const now = Math.floor(Date.now() / 1000);
  
  const jwtClaimSet = {
    "iss": clientEmail,
    "scope": "https://www.googleapis.com/auth/datastore",
    "aud": "https://oauth2.googleapis.com/token",
    "exp": now + 3600,
    "iat": now
  };
  
  const jwtHeaderBase64 = Utilities.base64EncodeWebSafe(JSON.stringify(jwtHeader));
  const jwtClaimSetBase64 = Utilities.base64EncodeWebSafe(JSON.stringify(jwtClaimSet));
  
  const signatureInput = jwtHeaderBase64 + "." + jwtClaimSetBase64;
  const signature = Utilities.computeRsaSha256Signature(signatureInput, privateKey);
  const jwt = signatureInput + "." + Utilities.base64EncodeWebSafe(signature);
  
  const response = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
    method: "post",
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    }
  });
  
  const responseObj = JSON.parse(response.getContentText());
  return responseObj.access_token;
} 