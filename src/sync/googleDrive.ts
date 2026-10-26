const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';

export async function syncToGoogleDrive(
  accessToken: string,
  encryptedBytes: Uint8Array,
  vaultName: string
): Promise<string> {
  const fileName = `netto_vault_${vaultName}.sqlite.enc`;

  try {
    // 1. Search if the file already exists in the private appDataFolder
    const searchUrl = `${DRIVE_FILES_URL}?spaces=appDataFolder&q=name='${encodeURIComponent(
      fileName
    )}' and trashed=false&fields=files(id, name)`;

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!searchRes.ok) {
      const errBody = await searchRes.text();
      throw new Error(`Drive lookup failed (${searchRes.status}): ${errBody}`);
    }

    const searchData = await searchRes.json();
    const existingFile = searchData.files?.[0];

    // 2. Prepare multipart body
    const metadata = {
      name: fileName,
      parents: ['appDataFolder'],
    };

    const boundary = '-------netto_multipart_boundary_713130';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadataPart =
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` + JSON.stringify(metadata);

    const encoder = new TextEncoder();
    const metaBytes = encoder.encode(
      delimiter + metadataPart + `\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`
    );
    const closeBytes = encoder.encode(closeDelimiter);

    const fullPayload = new Uint8Array(metaBytes.length + encryptedBytes.length + closeBytes.length);
    fullPayload.set(metaBytes, 0);
    fullPayload.set(encryptedBytes, metaBytes.length);
    fullPayload.set(closeBytes, metaBytes.length + encryptedBytes.length);

    let uploadRes: Response;

    if (existingFile) {
      // Pass the underlying ArrayBuffer slice as BodyInit
      uploadRes = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/octet-stream',
          },
          body: encryptedBytes.buffer.slice(
            encryptedBytes.byteOffset,
            encryptedBytes.byteOffset + encryptedBytes.byteLength
          ) as ArrayBuffer,
        }
      );
    } else {
      // Pass the composite payload ArrayBuffer slice as BodyInit
      uploadRes = await fetch(DRIVE_UPLOAD_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: fullPayload.buffer.slice(
          fullPayload.byteOffset,
          fullPayload.byteOffset + fullPayload.byteLength
        ) as ArrayBuffer,
      });
    }

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Drive upload failed (${uploadRes.status}): ${errText}`);
    }

    return `Synced [${fileName}] to Google Drive!`;
  } catch (err: any) {
    console.error('[Google Drive Sync Error]:', err);
    throw err;
  }
}

export async function loadFromGoogleDrive(
  accessToken: string,
  vaultName: string
): Promise<Uint8Array | null> {
  const fileName = `netto_vault_${vaultName}.sqlite.enc`;

  try {
    const searchUrl = `${DRIVE_FILES_URL}?spaces=appDataFolder&q=name='${encodeURIComponent(
      fileName
    )}' and trashed=false&fields=files(id, name)`;

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!searchRes.ok) {
      const errBody = await searchRes.text();
      throw new Error(`Drive lookup failed (${searchRes.status}): ${errBody}`);
    }

    const searchData = await searchRes.json();
    const existingFile = searchData.files?.[0];

    if (!existingFile) {
      alert(`No backup found on Google Drive for vault "${vaultName}" (looking for ${fileName})`);
      return null;
    }

    const downloadRes = await fetch(
      `${DRIVE_FILES_URL}/${existingFile.id}?alt=media`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!downloadRes.ok) {
      const errBody = await downloadRes.text();
      throw new Error(`Drive download failed (${downloadRes.status}): ${errBody}`);
    }

    const buffer = await downloadRes.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (err: any) {
    console.error('[Google Drive Load Error]:', err);
    alert(`Failed to fetch from Drive: ${err?.message || err}`);
    return null;
  }
}