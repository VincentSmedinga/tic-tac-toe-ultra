import type { HouseMember } from '../../shared/house-protocol.ts'
import type { Text } from '../i18n/types.ts'

/** A name as the house shows it: with a number when somebody before had the same one. */
export function nameOf(t: Text, member: HouseMember): string {
  return member.number === undefined
    ? member.name
    : t('house.person.number', { name: member.name, number: member.number })
}
