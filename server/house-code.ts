import { HOUSE_CODE_LENGTH } from '../shared/house.ts'

/** A new house code: six digits. A random byte from 250 up is skipped, so that no digit is likelier. */
export function newHouseCode(): string {
  let code = ''
  while (code.length < HOUSE_CODE_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(HOUSE_CODE_LENGTH * 2))) {
      if (byte < 250 && code.length < HOUSE_CODE_LENGTH) code += (byte % 10).toString()
    }
  }
  return code
}
