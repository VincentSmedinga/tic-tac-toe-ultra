import { useEffect, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { HOUSE_CODE_LENGTH } from '../../shared/house.ts'
import { houseCodeSchema } from '../../shared/house-protocol.ts'
import { roomCodeSchema } from '../../shared/protocol.ts'
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
import { fieldLabel, isClassic } from '../play/field.ts'
import type { HouseApi } from '../house/api.ts'
import { houseApi as browserHouseApi } from '../house/api.ts'
import type { RoomApi } from './api.ts'
import { roomApi } from './api.ts'
import {
  clearLastHouse,
  clearLastRoom,
  getLastHouse,
  getLastRoom,
  getName,
  getRoomChoice,
  setRoomChoice,
} from './identity.ts'
import { Link } from './Link.tsx'
import { housePath, navigate, roomPath } from './route.ts'
import './Online.css'

interface StartScreenProps {
  /** Set when the address of a room or a house was no code. */
  notice?: 'bad-code' | 'bad-house-code'
  api?: RoomApi
  houseApi?: HouseApi
}

/**
 * What can be in the field for a code: a room's code (only the letters it has, in capitals, no
 * longer than a code), or a house's once there is a digit in it (only digits, no more than six).
 */
function cleanCode(text: string): string {
  if (/\d/.test(text)) return text.replace(/\D/g, '').slice(0, HOUSE_CODE_LENGTH)
  const letters = new RegExp(`[^${ROOM_CODE_ALPHABET}]`, 'g')
  return text.toUpperCase().replace(letters, '').slice(0, ROOM_CODE_LENGTH)
}

/** Where you start: a new room, a house, a room or house of someone else, or the game on one screen. */
export function StartScreen({
  notice,
  api = roomApi,
  houseApi = browserHouseApi,
}: StartScreenProps) {
  const t = useText()
  // The name is chosen on the settings page; the start screen only says whose it is.
  const name = getName()
  const [code, setCode] = useState('')
  // Which choice a message is about, so that it shows in that choice and not somewhere else.
  // The message is kept as its key, so that it changes language with the page.
  const [message, setMessage] = useState<{
    card: 'create' | 'house' | 'join'
    key: PlainKey
  } | null>(
    notice === 'bad-code'
      ? { card: 'join', key: 'start.badCode' }
      : notice === 'bad-house-code'
        ? { card: 'join', key: 'start.badHouseCode' }
        : null,
  )
  const [busy, setBusy] = useState(false)
  // A new room is made with what the last one was made with, and a classic room the first time.
  const [last] = useState(getRoomChoice)
  const [field, setFieldState] = useState<FieldSettings>(last?.field ?? CLASSIC_FIELD)
  const [players, setPlayersState] = useState(last?.players ?? DEFAULT_PLAYERS)
  // The way to change them is behind a line that says what they are.
  const [adjusting, setAdjusting] = useState(false)
  // The room this browser last sat in, when it is still there: a way back after going to the start.
  const [resume, setResume] = useState<string | null>(null)
  // The same for the house this browser was last in.
  const [resumeHouse, setResumeHouse] = useState<string | null>(null)

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

  useEffect(() => {
    const last = getLastHouse()
    if (last === null) return
    let current = true
    void houseApi
      .houseExists(last)
      .then((exists) => {
        if (!current) return
        if (exists) setResumeHouse(last)
        else clearLastHouse()
      })
      .catch(() => {
        // Can't ask just now: leave the offer out.
      })
    return () => {
      current = false
    }
  }, [houseApi])

  function setField(next: FieldSettings) {
    setFieldState(next)
    setRoomChoice({ players, field: next })
  }

  function setPlayers(next: number) {
    setPlayersState(next)
    setRoomChoice({ players: next, field })
  }

  async function createRoom() {
    setBusy(true)
    setMessage(null)
    try {
      navigate(roomPath(await api.createRoom({ ...field, players })))
    } catch {
      setMessage({ card: 'create', key: 'common.createRoomFailed' })
      setBusy(false)
    }
  }

  async function createHouse() {
    setBusy(true)
    setMessage(null)
    try {
      navigate(housePath(await houseApi.createHouse()))
    } catch {
      setMessage({ card: 'house', key: 'start.house.failed' })
      setBusy(false)
    }
  }

  /** The code is a room's or a house's: the field takes both, and the code says which. */
  async function join(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    const house = houseCodeSchema.safeParse(code).success
    if (!house && !roomCodeSchema.safeParse(code).success) {
      setMessage({ card: 'join', key: 'start.codeKinds' })
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      if (house ? await houseApi.houseExists(code) : await api.roomExists(code)) {
        navigate(house ? housePath(code) : roomPath(code))
        return
      }
      setMessage({ card: 'join', key: house ? 'start.noSuchHouse' : 'start.noSuchRoom' })
    } catch {
      setMessage({ card: 'join', key: house ? 'start.searchHouseFailed' : 'start.searchFailed' })
    }
    setBusy(false)
  }

  const alert = (card: 'create' | 'house' | 'join') =>
    message?.card === card && (
      <p className="message" role="alert">
        {t(message.key)}
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

      {resumeHouse !== null && (
        <section className="choice choice-primary" aria-labelledby="resume-house-title">
          <h2 id="resume-house-title">{t('start.resumeHouse.title')}</h2>
          <p>
            <Rich
              text="start.resumeHouse.body"
              values={{ code: <strong className="resume-code">{resumeHouse}</strong> }}
            />
          </p>
          <Link to={housePath(resumeHouse)} className="button button-primary">
            {t('start.resumeHouse.link', { code: resumeHouse })}
          </Link>
        </section>
      )}

      <section className="choice choice-primary" aria-labelledby="create-title">
        <h2 id="create-title">{t('start.create.title')}</h2>
        <p>{t('start.create.body')}</p>
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
        <button
          type="button"
          className="adjust"
          aria-expanded={adjusting}
          aria-controls="create-options"
          onClick={() => {
            setAdjusting(!adjusting)
          }}
        >
          {t('start.create.summary', { count: players, field: fieldLabel(t, field) })} ·{' '}
          {t('start.create.adjust')}
        </button>
        {adjusting && (
          <div id="create-options" className="create-options">
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
          </div>
        )}
        {alert('create')}
      </section>

      <section className="choice" aria-labelledby="house-title">
        <h2 id="house-title">{t('start.house.title')}</h2>
        <p>{t('start.house.body')}</p>
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={() => {
            void createHouse()
          }}
        >
          {t('start.house.button')}
        </button>
        {alert('house')}
      </section>

      <section className="choice" aria-labelledby="join-title">
        <h2 id="join-title">{t('start.join.title')}</h2>
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
              maxLength={HOUSE_CODE_LENGTH}
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

      <Link to="/samen" className="button">
        {t('start.local.title')}
      </Link>

      <p className="start-name">
        {name === '' ? (
          <Link to="/instellingen">{t('start.addName')}</Link>
        ) : (
          <>
            {t('start.playingAs', { name })} <Link to="/instellingen">{t('start.changeName')}</Link>
          </>
        )}
      </p>
    </div>
  )
}
