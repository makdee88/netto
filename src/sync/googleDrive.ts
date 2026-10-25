const DB_FILENAME = 'netto_vault.sqlite.enc';

export async function syncToGoogleDrive(accessToken: string, encryptedBytes: Uint8Array): Promise<string> {
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${DB_FILENAME}'&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();
  const existingFileId = searchData.files?.[0]?.id;

  const metadata = {
    name: DB_FILENAME,
    ...(existingFileId ? {} : { parents: ['appDataFolder'] }),
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([encryptedBytes as any], { type: 'application/octet-stream' }));

  const uploadUrl = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const res = await fetch(uploadUrl, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  if (!res.ok) throw new Error('Google Drive upload failed');
  return 'AES-256 Encrypted Netto Vault synced to Google Drive!';
}

export async function loadFromGoogleDrive(accessToken: string): Promise<Uint8Array | null> {
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${DB_FILENAME}'&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();
  const fileId = searchData.files?.[0]?.id;
  if (!fileId) return null;

  const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!fileRes.ok) return null;
  const buf = await fileRes.arrayBuffer();
  return new Uint8Array(buf);
}