document.getElementById('backupFile').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const status = document.getElementById('status');
  status.textContent = 'Reading file...';
  status.className = 'status-message';

  try {
    const text = await file.text();
    const json = JSON.parse(text);

    if (typeof json !== 'object') throw new Error('Invalid JSON format');

    status.textContent = 'Importing data...';
    
    // Send to background script
    await browser.runtime.sendMessage({ 
      command: 'importData', 
      payload: { data: json } 
    });

    status.textContent = 'Import Successful! You can now close this tab.';
    status.className = 'status-message status-success';

  } catch (error) {
    console.error('Import failed:', error);
    status.textContent = 'Import Failed: ' + error.message;
    status.className = 'status-message status-error';
  }
});
