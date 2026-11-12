import { useState } from 'react'
import type { SyntheticEvent } from 'react'
import type { HouseClientMessage, HouseState } from '../../shared/house-protocol.ts'
import { CLASSIC_FIELD, PLAYER_LIMITS } from '../../shared/room.ts'
import type { FieldSettings } from '../../shared/room.ts'
import { useText } from '../i18n/store.ts'
import { getRoomChoice } from '../online/identity.ts'
import { Link } from '../online/Link.tsx'
import { roomPath } from '../online/route.ts'
import { FieldPicker } from '../play/FieldPicker.tsx'
import { fieldLabel } from '../play/field.ts'
import { ShapeIcon } from '../shapes/ShapeIcon.tsx'
import { nameOf } from './names.ts'

interface InviteProps {
  state: HouseState
  send: (message: HouseClientMessage) => void
}

/**
 * Starting a game: choosing who plays among those who are free and have a shape, and the field (as
 * on the start screen), and inviting them. Only for somebody who is free and has a shape.
 */
export function InviteForm({ state, send }: InviteProps) {
  const t = useText()
  const [chosen, setChosen] = useState<readonly string[]>([])
  const [field, setField] = useState<FieldSettings>(() => getRoomChoice()?.field ?? CLASSIC_FIELD)
  const [missing, setMissing] = useState(false)

  const free = state.members.filter(
    (member) => member.id !== state.you && member.status === 'free' && member.shape !== undefined,
  )
  // Somebody who was chosen and isn't free any more is left out.
  const people = chosen.filter((id) => free.some((member) => member.id === id))
  const full = people.length >= PLAYER_LIMITS.max - 1

  function invite(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (people.length === 0) {
      setMissing(true)
      return
    }
    send({ type: 'invite', people, field })
    setChosen([])
  }

  return (
    <form className="house-invite" aria-labelledby="house-invite-title" onSubmit={invite}>
      <h3 id="house-invite-title">{t('house.invite.title')}</h3>
      {free.length === 0 ? (
        <p>{t('house.invite.nobodyFree')}</p>
      ) : (
        <>
          <fieldset className="house-invite-people">
            <legend>{t('house.invite.who')}</legend>
            {free.map((member) => {
              const checked = people.includes(member.id)
              return (
                <label key={member.id} className="house-invite-person">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!checked && full}
                    onChange={() => {
                      setMissing(false)
                      setChosen(
                        checked ? people.filter((id) => id !== member.id) : [...people, member.id],
                      )
                    }}
                  />
                  {member.shape && <ShapeIcon shape={member.shape} size={28} decorative />}
                  <span>{nameOf(t, member)}</span>
                </label>
              )
            })}
          </fieldset>
          <FieldPicker value={field} onChange={setField} />
          {missing && (
            <p className="message" role="alert">
              {t('house.invite.pickSomeone')}
            </p>
          )}
          <button type="submit" className="button button-primary">
            {t('house.invite.button')}
          </button>
        </>
      )}
    </form>
  )
}

/**
 * The invitation this person is part of: invited and not answered yet, with "Speel mee" and "Nee,
 * dank je"; or waiting for the others, as the one who invited or after saying yes.
 */
export function InvitationCard({ state, send }: InviteProps) {
  const t = useText()
  const invitation = state.invitation
  if (!invitation) return null
  const mine = invitation.people.find((person) => person.id === state.you)
  const from = state.members.find((member) => member.id === invitation.from)

  if (mine?.answer !== 'open') {
    return (
      <p className="house-waiting" role="status">
        {t('house.waiting')}
      </p>
    )
  }

  return (
    <section className="choice choice-primary house-invited" aria-labelledby="house-invited-title">
      <h3 id="house-invited-title">
        {t('house.invited.title', { name: from ? nameOf(t, from) : t('player.someone') })}
      </h3>
      <p>{t('house.invited.body', { field: fieldLabel(t, invitation.field) })}</p>
      <div className="actions">
        <button
          type="button"
          className="button button-primary"
          onClick={() => {
            send({ type: 'answer', yes: true })
          }}
        >
          {t('house.invited.yes')}
        </button>
        <button
          type="button"
          className="button"
          onClick={() => {
            send({ type: 'answer', yes: false })
          }}
        >
          {t('house.invited.no')}
        </button>
      </div>
    </section>
  )
}

/** The game this person is playing in a room of the house, for when they are back in the house. */
export function PlayingCard({ room }: { room: string }) {
  const t = useText()
  return (
    <section className="choice house-playing" aria-labelledby="house-playing-title">
      <h3 id="house-playing-title">{t('house.playing.title')}</h3>
      <Link to={roomPath(room)} className="button button-primary">
        {t('house.playing.link')}
      </Link>
    </section>
  )
}
