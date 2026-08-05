export const PASSWORD_MIN_LENGTH = 10;

export type PasswordChecks = {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  symbol: boolean;
  noWhitespace: boolean;
};

export function checkPassword(password: string): PasswordChecks {
  return {
    length: password.length >= PASSWORD_MIN_LENGTH,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9\s]/.test(password),
    noWhitespace: !/\s/.test(password),
  };
}

export function isStrongPassword(password: string): boolean {
  return Object.values(checkPassword(password)).every(Boolean);
}
