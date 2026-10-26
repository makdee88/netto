const getDriveFileName = (vaultName: string = 'Personal') => {
  const safeName = vaultName.trim().replace(/[^a-zA-Z0-9_-]/g, '') || 'Personal';
  return `netto_vault_${safeName}.sqlite.enc`;
};

export async function syncToGoogleDrive(
  accessToken: string,
  encryptedBytes: Uint8Array,
  vaultName: string = 'Personal'
): Promise<string> {
  const fileName = getDriveFileName(vaultName);

  const searchUrl = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(
    `name = '${fileName}' and trashed = false`
  )}&fields=files(id,name)`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!searchRes.ok) {
    throw new Error('Failed to search Google Drive appDataFolder.');
  }

  const searchData = await searchRes.json();
  const existingFileId = searchData.files?.[0]?.id;

  const metadata = {
    name: fileName,
    ...(existingFileId ? {} : { parents: ['appDataFolder'] }),
  };

  const boundary = '-------netto_vault_sync_boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata);

  const mediaHeader =
    delimiter + 'Content-Type: application/octet-stream\r\n\r\n';

  const encoder = new TextEncoder();
  const metaBytes = encoder.encode(metadataPart);
  const headerBytes = encoder.encode(mediaHeader);
  const closeBytes = encoder.encode(closeDelimiter);

  const body = new Uint8Array(
    metaBytes.length + headerBytes.length + encryptedBytes.length + closeBytes.length
  );
  body.set(metaBytes, 0);
  body.set(headerBytes, metaBytes.length);
  body.set(encryptedBytes, metaBytes.length + headerBytes.length);
  body.set(closeBytes, metaBytes.length + headerBytes.length + encryptedBytes.length);

  const uploadUrl = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const uploadRes = await fetch(uploadUrl, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!uploadRes.ok) {
    throw new Error(`Failed to upload ${fileName} to Google Drive.`);
  }

  return `Synced [${fileName}] to Google Drive`;
}

export async function loadFromGoogleDrive(
  accessToken: string,
  vaultName: string = 'Personal'
): Promise<Uint8Array | null> {
  const fileName = getDriveFileName(vaultName);

  const searchUrl = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(
    `name = '${fileName}' and trashed = false`
  )}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!searchRes.ok) {
    throw new Error('Failed to query Google Drive.');
  }

  const searchData = await searchRes.json();
  let fileId = searchData.files?.[0]?.id;

  // Backward compatibility fallback: check for legacy single vault name
  if (!fileId && vaultName === 'Personal') {
    const legacyUrl = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(
      `name = 'netto_vault.sqlite.enc' and trashed = false`
    )}&fields=files(id,name)`;
    const legacyRes = await fetch(legacyUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (legacyRes.ok) {
      const legacyData = await legacyRes.json();
      fileId = legacyData.files?.[0]?.id;
    }
  }

  if (!fileId) {
    alert(`No backup named "${fileName}" found in Google Drive.`);
    return null;
  }

  const downloadRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!downloadRes.ok) {
    throw new Error(`Failed to download ${fileName} from Google Drive.`);
  }

  const buffer = await downloadRes.arrayBuffer();
  return new Uint8Array(buffer);
}