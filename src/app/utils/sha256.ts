// Hex SHA-256 of some text, for the /sha256 command.
export const sha256Hex = async (text: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
};

// Marks a message sent with /sha256, so Angaara can show it collapsed.
export const SHA256_MESSAGE_KEY = 'io.angaara.sha256';
