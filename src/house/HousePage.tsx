import { useEffect, useState } from 'react'
import type { ReactNode, SyntheticEvent } from 'react'
import type { HouseClientMessage, HouseMember, HouseState } from '../../shared/house-protocol.ts'
import { MAX_NAME_LENGTH } from '../../shared/protocol.ts'
import type { ShapeId } from '../../shared/shapes.ts'
import { useText } from '../i18n/store.ts'
import type { PlainKey, Text } from '../i18n/types.ts'
import { CopyLink } from '../online/CopyLink.tsx'
import {
  clearLastHouse,
  getName,
  getShape,
  getToken,
  sanitizeName,
  setLastHouse,
  setName,
  setShape,
} from '../online/identity.ts'
import { Link } from '../online/Link.tsx'
import { housePath } from '../online/route.ts'
import { Lost } from '../online/RoomPage.tsx'
import { useScrollToTop } from '../online/scroll.ts'
import { ShapePicker } from '../play/ShapePicker.tsx'
import { ShapeIcon } from '../shapes/ShapeIcon.tsx'
import { browserHouseDeps, useHouse } from './useHouse.ts'
import type { HouseDeps, HouseIdentity, HouseProblem } from './useHouse.ts'
import '../online/Online.css'
import './House.css'

interface HousePageProps {
  code: string
  deps?: HouseDeps
}

/** What each problem of a house is called; the server sends codes and no words. */
const PROBLEMS: Record<HouseProblem, PlainKey> = {
  'unknown-house': 'problem.unknownHouse',
  'house-full': 'problem.houseFull',
  'shape-taken': 'problem.houseShapeTaken',
  replaced: 'problem.replaced',
  unreachable: 'problem.houseUnreachable',
  'invalid-message': 'problem.generic',
  'not-joined': 'problem.generic',
}

/**
 * A house: first who you are (a name is needed here, the one of last time is filled in), then who
 * else has the house open and the shape you have in it.
 */
export function HousePage({ code, deps = browserHouseDeps }: HousePageProps) {
  const t = useText()
  const [identity, setIdentity] = useState<HouseIdentity | null>(null)
  const { connection, state, problem, retry, send } = useHouse(code, identity, deps)

  // Remember the house once you are in it, so that the start screen leads back; forget it when it is gone.
  const inside = state !== null
  useEffect(() => {
    if (inside) setLastHouse(code)
    else if (problem === 'unknown-house') clearLastHouse()
  }, [inside, problem, code])

  // The shape you have in the house is the one a room and the next house ask for.
  const mine = state?.members.find((member) => member.id === state.you)?.shape
  useEffect(() => {
    if (mine) setShape(mine)
  }, [mine])

  if (identity === null) {
    return (
      <HouseEnter
        code={code}
        onEnter={(name) => {
          setName(name)
          setIdentity({ token: getToken(), name, shape: getShape() })
        }}
      />
    )
  }

  const stops = problem !== null && problem !== 'shape-taken' && problem !== 'not-joined'
  if (stops && (state === null || problem !== 'unreachable')) {
    const canRetry =
      problem === 'replaced' || problem === 'unreachable' || problem === 'invalid-message'
    return (
      <div className="room house">
        <p className="message" role="alert">
          {t(PROBLEMS[problem])}
        </p>
        <div className="actions">
          {canRetry && (
            <button type="button" className="button button-primary" onClick={retry}>
              {t('common.retry')}
            </button>
          )}
          <Link to="/" className="button">
            {t('nav.back')}
          </Link>
        </div>
      </div>
    )
  }

  if (state === null) {
    if (connection === 'closed') return <Lost onRetry={retry} />
    return (
      <p className="room" role="status">
        {t('house.connecting')}
      </p>
    )
  }

  return (
    <HouseView
      state={state}
      send={send}
      problem={problem === 'shape-taken' ? problem : null}
      banner={
        connection === 'open' ? null : (
          <Lost onRetry={retry} connecting={connection === 'connecting'} />
        )
      }
    />
  )
}

interface HouseEnterProps {
  code: string
  onEnter: (name: string) => void
}

/** Who you are, before you come in: the name of last time is filled in, and may be changed. */
export function HouseEnter({ code, onEnter }: HouseEnterProps) {
  const t = useText()
  const [name, setNameState] = useState(getName)
  const [missing, setMissing] = useState(false)

  function enter(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    const clean = sanitizeName(name)
    if (clean === '') {
      setMissing(true)
      return
    }
    onEnter(clean)
  }

  return (
    <div className="room house">
      <form className="choice choice-primary" aria-labelledby="house-enter-title" onSubmit={enter}>
        <h2 id="house-enter-title">{t('house.enter.title')}</h2>
        <p>{t('house.enter.body', { code })}</p>
        <div className="field">
          <label htmlFor="house-name">{t('house.enter.name')}</label>
          <input
            id="house-name"
            type="text"
            autoComplete="nickname"
            maxLength={MAX_NAME_LENGTH}
            value={name}
            aria-invalid={missing}
            aria-describedby={missing ? 'house-name-missing' : undefined}
            onChange={(event) => {
              setNameState(event.target.value)
              setMissing(false)
            }}
          />
        </div>
        {missing && (
          <p id="house-name-missing" className="message" role="alert">
            {t('house.enter.nameNeeded')}
          </p>
        )}
        <button type="submit" className="button button-primary">
          {t('house.enter.button')}
        </button>
      </form>
    </div>
  )
}

interface HouseViewProps {
  state: HouseState
  send: (message: HouseClientMessage) => void
  /** A choice the house refused. */
  problem?: 'shape-taken' | null
  /** The connection is gone for a moment: said above everything. */
  banner?: ReactNode
}

/** The house from the inside: its code to pass on, who is there, and your shape. */
export function HouseView({ state, send, problem = null, banner = null }: HouseViewProps) {
  const t = useText()
  useScrollToTop('house')
  const mine = state.members.find((member) => member.id === state.you)

  // The shapes the others have can't be picked: with whose they are.
  const taken: Partial<Record<ShapeId, string>> = {}
  for (const member of state.members) {
    if (member.id !== state.you && member.shape) taken[member.shape] = nameOf(t, member)
  }

  return (
    <div className="room house">
      {banner}
      <h2>{t('house.title')}</h2>
      <p
        className="room-code"
        aria-label={t('house.code', { digits: state.code.split('').join(' ') })}
      >
        {state.code}
      </p>
      <CopyLink
        link={`${window.location.origin}${housePath(state.code)}`}
        lead={t('house.share')}
      />
      <section className="house-people" aria-labelledby="house-people-title">
        <h3 id="house-people-title">{t('house.people')}</h3>
        <ul className="players">
          {state.members.map((member) => (
            <Member key={member.id} member={member} you={member.id === state.you} />
          ))}
        </ul>
        {state.members.length < 2 && <p>{t('house.alone')}</p>}
      </section>
      <ShapePicker
        label={t('house.pickShape')}
        value={mine?.shape ?? null}
        taken={taken}
        onChange={(shape) => {
          send({ type: 'choose', shape })
        }}
      />
      {problem && (
        <p className="message" role="alert">
          {t(PROBLEMS[problem])}
        </p>
      )}
    </div>
  )
}

/** A name as the house shows it: with a number when somebody before had the same one. */
function nameOf(t: Text, member: HouseMember): string {
  return member.number === undefined
    ? member.name
    : t('house.person.number', { name: member.name, number: member.number })
}

const STATUS: Record<HouseMember['status'], PlainKey> = {
  free: 'house.person.free',
  playing: 'house.person.playing',
  watching: 'house.person.watching',
}

/** One person in the house: their shape, their name, and what they are doing. */
function Member({ member, you }: { member: HouseMember; you: boolean }) {
  const t = useText()
  // What else there is to say, in a row: the dash is punctuation, every word comes from the dictionary.
  const notes = [
    you && t('player.you'),
    member.shape === undefined && t('player.choosing'),
    t(STATUS[member.status]),
  ].filter(Boolean)
  return (
    <li className="player" {...(you ? { 'data-you': '' } : {})}>
      {member.shape ? (
        <ShapeIcon shape={member.shape} size={32} decorative />
      ) : (
        <span className="shape-blank" aria-hidden="true" />
      )}
      <span>{[nameOf(t, member), ...notes].join(' – ')}</span>
    </li>
  )
}
