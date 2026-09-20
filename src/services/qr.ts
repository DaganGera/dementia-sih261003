// QR code utility helper for MindCare AI device pairing

export interface QRPayload {
  protocol: 'mindcare';
  action: 'connect';
  token: string;
  caregiverName: string;
  elderlyName: string;
  createdAt: number;
}

export const QRService = {
  /**
   * Generates a formatted connection payload string: mindcare://connect/{token}?caregiver={name}&elderly={name}
   */
  createConnectionToken(caregiverName = 'Anitha Sharma', elderlyName = 'Meena Sharma'): string {
    const token = `MC-${Math.floor(100000 + Math.random() * 900000)}`;
    const payload: QRPayload = {
      protocol: 'mindcare',
      action: 'connect',
      token,
      caregiverName,
      elderlyName,
      createdAt: Date.now(),
    };
    return JSON.stringify(payload);
  },

  /**
   * Parses and validates scanned QR code content
   */
  parseConnectionToken(qrText: string): QRPayload | null {
    if (!qrText) return null;
    const cleanText = qrText.trim();

    // 1. Try parsing JSON payload
    try {
      const parsed = JSON.parse(cleanText);
      if (parsed && parsed.protocol === 'mindcare' && parsed.token) {
        return parsed as QRPayload;
      }
    } catch (e) {
      // Not raw JSON, continue to string/URL parsing
    }

    // 2. Try parsing URL query parameters (e.g., https://site.com?token=MC-910238)
    if (cleanText.includes('token=')) {
      try {
        const urlObj = new URL(cleanText);
        const tokenFromUrl = urlObj.searchParams.get('token');
        const cg = urlObj.searchParams.get('caregiver');
        const el = urlObj.searchParams.get('elderly');
        if (tokenFromUrl) {
          return {
            protocol: 'mindcare',
            action: 'connect',
            token: tokenFromUrl.trim().toUpperCase(),
            caregiverName: cg ? decodeURIComponent(cg) : 'Caregiver',
            elderlyName: el ? decodeURIComponent(el) : 'Patient',
            createdAt: Date.now(),
          };
        }
      } catch (e) {
        // Fallback for partial URL strings
        const match = cleanText.match(/token=([A-Za-z0-9-]+)/);
        if (match && match[1]) {
          return {
            protocol: 'mindcare',
            action: 'connect',
            token: match[1].trim().toUpperCase(),
            caregiverName: 'Caregiver',
            elderlyName: 'Patient',
            createdAt: Date.now(),
          };
        }
      }
    }

    // 3. Fallback check for direct token strings e.g. MC-DEMO-7789 or MC-910238
    if (cleanText.startsWith('MC-') || cleanText.length >= 6) {
      return {
        protocol: 'mindcare',
        action: 'connect',
        token: cleanText.toUpperCase(),
        caregiverName: 'Caregiver',
        elderlyName: 'Patient',
        createdAt: Date.now(),
      };
    }

    return null;
  },
};
