import { useEffect, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { MAX_NAME_LENGTH, roomCodeSchema } from '../../shared/protocol.ts'
import {
  CLASSIC_FIELD,
  DEFAULT_PLAYERS,
  PLAYER_LIMITS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from '../../shared/room.ts'
import type { FieldSettings } from '../../shared/room.ts'
import { Rich } from '../i18n/Rich.tsx'
import { useText } from '../i18n/store.ts'
import type { PlainKey } from '../i18n/types.ts'
import { FieldPicker } from '../play/FieldPicker.tsx'
import { isClassic } from '../play/field.ts'
import type { RoomApi } from './api.ts'
import { roomApi } from './api.ts'
import { clearLastRoom, getLastRoom, getName, setName } from './identity.ts'
import { Link } from './Link.tsx'
import { navigate, roomPath } from './route.ts'
import './Online.css'

interface StartScreenProps {
  /** Set when the address of a room was no code. */
  notice?: 'bad-code'
  api?: RoomApi
}

/** Only the letters a room code has, in capitals, and no more than a code is long. */
function cleanCode(text: string): string {
  const letters = new RegExp(`[^${ROOM_CODE_ALPHABET}]`, 'g')
  return text.toUpperCase().replace(letters, '').slice(0, ROOM_CODE_LENGTH)
}

/** Where you start: a new room, a room of someone else, or the game on one screen. */
export function StartScreen({ notice, api = roomApi }: StartScreenProps) {
  const t = useText()
  const [name, setNameState] = useState(getName)
  const [code, setCode] = useState('')
  // Which choice a message is about, so that it shows in that choice and not somewhere else.
  // The message is kept as its key, so that it changes language with the page.
  const [message, setMessage] = useState<{
    card: 'create' | 'join'
    key: PlainKey | 'start.codeLength'
  } | null>(notice === 'bad-code' ? { card: 'join', key: 'start.badCode' } : null)
  const [busy, setBusy] = useState(false)
  const [field, setField] = useState<FieldSettings>(CLASSIC_FIELD)
  const [players, setPlayers] = useState(DEFAULT_PLAYERS)
  // The room this browser last sat in, when it is still there: a way back after going to the start.
  const [resume, setResume] = useState<string | null>(null)

  useEffect(() => {
    const last = getLastRoom()
    if (last === null) return
    let current = true
    void api
      .roomExists(last)
      .then((exists) => {
        if (!current) return
        if (exists) setResume(last)
        else clearLastRoom()
      })
      .catch(() => {
        // Can't ask just now: leave the offer out, the choices below still work.
      })
    return () => {
      current = false
    }
  }, [api])

  async function createRoom() {
    setBusy(true)
    setMessage(null)
    setName(name)
    try {
      navigate(roomPath(await api.createRoom({ ...field, players })))
    } catch {
      setMessage({ card: 'create', key: 'common.createRoomFailed' })
      setBusy(false)
    }
  }

  async function join(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!roomCodeSchema.safeParse(code).success) {
      setMessage({ card: 'join', key: 'start.codeLength' })
      return
    }
    setBusy(true)
    setMessage(null)
    setName(name)
    try {
      if (await api.roomExists(code)) {
        navigate(roomPath(code))
        return
      }
      setMessage({ card: 'join', key: 'start.noSuchRoom' })
    } catch {
      setMessage({ card: 'join', key: 'start.searchFailed' })
    }
    setBusy(false)
  }

  const alert = (card: 'create' | 'join') =>
    message?.card === card && (
      <p className="message" role="alert">
        {message.key === 'start.codeLength'
          ? t('start.codeLength', { length: ROOM_CODE_LENGTH })
          : t(message.key)}
      </p>
    )

  return (
    <div className="start">
      {resume !== null && (
        <section className="choice choice-primary" aria-labelledby="resume-title">
          <h2 id="resume-title">{t('start.resume.title')}</h2>
          <p>
            <Rich
              text="start.resume.body"
              values={{ code: <strong className="resume-code">{resume}</strong> }}
            />
          </p>
          <Link to={roomPath(resume)} className="button button-primary">
            {t('start.resume.link', { code: resume })}
          </Link>
        </section>
      )}

      <section className="choice choice-name" aria-labelledby="who-title">
        <h2 id="who-title">{t('start.who.title')}</h2>
        <div className="field">
          <label htmlFor="player-name">{t('start.who.name')}</label>
          <input
            id="player-name"
            name="given-name"
            type="text"
            // "given-name" is what makes Safari offer the name from the Contacts app.
            autoComplete="given-name"
            autoCapitalize="words"
            enterKeyHint="done"
            maxLength={MAX_NAME_LENGTH}
            value={name}
            onChange={(event) => {
              setNameState(event.target.value)
            }}
          />
        </div>
      </section>

      <p className="start-lead">{t('start.lead')}</p>

      <section className="choice choice-primary" aria-labelledby="create-title">
        <h2 id="create-title">{t('start.create.title')}</h2>
        <p>{t('start.create.body')}</p>
        <div className="player-count-row">
          <label htmlFor="player-count">{t('play.playerCount')}</label>
          <select
            id="player-count"
            className="player-count"
            value={players}
            onChange={(event) => {
              setPlayers(Number(event.target.value))
            }}
          >
            {Array.from(
              { length: PLAYER_LIMITS.max - PLAYER_LIMITS.min + 1 },
              (_, index) => PLAYER_LIMITS.min + index,
            ).map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </div>
        {players > 2 && isClassic(field) && (
          <p className="field-tip">{t('start.create.biggerIsNicer')}</p>
        )}
        <FieldPicker value={field} onChange={setField} />
        <button
          type="button"
          className="button button-primary"
          disabled={busy}
          onClick={() => {
            void createRoom()
          }}
        >
          {t('start.create.button')}
        </button>
        {alert('create')}
      </section>

      <section className="choice" aria-labelledby="join-title">
        <h2 id="join-title">{t('start.join.title')}</h2>
        <p>{t('start.join.body')}</p>
        <form className="join" onSubmit={(event) => void join(event)}>
          <div className="field">
            <label htmlFor="room-code">{t('start.join.code')}</label>
            <input
              id="room-code"
              className="code-input"
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={ROOM_CODE_LENGTH}
              placeholder="BCDF"
              value={code}
              onChange={(event) => {
                setCode(cleanCode(event.target.value))
              }}
            />
          </div>
          <button type="submit" className="button" disabled={busy}>
            {t('start.join.button')}
          </button>
        </form>
        {alert('join')}
      </section>

      <section className="choice" aria-labelledby="local-title">
        <h2 id="local-title">{t('start.local.title')}</h2>
        <p>{t('start.local.body')}</p>
        <Link to="/samen" className="button">
          {t('start.local.button')}
        </Link>
      </section>
    </div>
  )
}
