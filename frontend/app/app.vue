<script setup lang="ts">
import { formatEther } from 'ethers'
import Addresses from './contracts/addresses.json'

type OutcomeView = {
  id: number
  name: string
  pool: bigint
  probabilityBps: bigint
}

type MarketView = {
  id: number
  creator: string
  question: string
  resolutionContext: string
  deadline: bigint
  resolved: boolean
  winningOutcomeId: bigint
  totalPool: bigint
  outcomes: OutcomeView[]
  claimed: boolean
}

type NotificationTone = 'info' | 'success' | 'error'

type NotificationEntry = {
  id: number
  message: string
  tone: NotificationTone
  createdAt: number
  seen: boolean
}

const { account, chainId, connect, refreshConnection } = useWallet()
const {
  claimFaucet,
  getVoteBalance,
  getAllowance,
  approvePredictionMarket,
  createMarket,
  stake,
  resolveMarket,
  claimReward,
  getMarkets,
  hasClaimedReward,
  parseEther,
} = useContracts()

const status = ref('')
const loading = ref(false)
const voteBalance = ref<bigint>(0n)
const allowance = ref<bigint>(0n)
const markets = ref<MarketView[]>([])
const marketStakeInputs = reactive<Record<number, string>>({})
const notifications = ref<NotificationEntry[]>([])
const showNotificationPanel = ref(false)
const toastVisible = ref(false)
const toastMessage = ref('')

const unreadNotificationCount = computed(() => {
  return notifications.value.filter((entry) => !entry.seen).length
})

let notificationId = 1
let toastTimer: ReturnType<typeof setTimeout> | null = null

const getNotificationTone = (message: string): NotificationTone => {
  const normalized = message.toLowerCase()

  if (
    normalized.includes('could not') ||
    normalized.includes('failed') ||
    normalized.includes('error') ||
    normalized.includes('required') ||
    normalized.includes('invalid')
  ) {
    return 'error'
  }

  if (
    normalized.includes('connected') ||
    normalized.includes('claimed') ||
    normalized.includes('created') ||
    normalized.includes('approved') ||
    normalized.includes('submitted') ||
    normalized.includes('resolved')
  ) {
    return 'success'
  }

  return 'info'
}

const showToast = (message: string) => {
  toastMessage.value = message
  toastVisible.value = true

  if (toastTimer) {
    clearTimeout(toastTimer)
  }

  toastTimer = setTimeout(() => {
    toastVisible.value = false
  }, 2800)
}

const pushNotification = (message: string) => {
  const trimmed = message.trim()
  if (!trimmed) {
    return
  }

  notifications.value.unshift({
    id: notificationId,
    message: trimmed,
    tone: getNotificationTone(trimmed),
    createdAt: Date.now(),
    seen: false,
  })
  notificationId += 1

  if (notifications.value.length > 50) {
    notifications.value.length = 50
  }

  showToast(trimmed)
}

const clearNotificationHistory = () => {
  notifications.value = []
}

const markNotificationsSeen = () => {
  notifications.value = notifications.value.map((entry) => ({
    ...entry,
    seen: true,
  }))
}

const toggleNotifications = () => {
  showNotificationPanel.value = !showNotificationPanel.value
  if (showNotificationPanel.value) {
    markNotificationsSeen()
  }
}

const closeNotifications = () => {
  showNotificationPanel.value = false
}

const formatNotificationTime = (value: number) => {
  return new Date(value).toLocaleTimeString()
}

const marketForm = reactive({
  question: '',
  duration: 30,
  durationUnit: 'minutes' as 'seconds' | 'minutes',
  resolutionContext: '',
})

const isAdmin = computed(() => account.value?.toLowerCase() === Addresses.admin.toLowerCase())
const hasWallet = computed(() => Boolean(account.value))

const formatBps = (value: bigint) => `${(Number(value) / 100).toFixed(2)}%`
const formatDeadline = (deadline: bigint) => new Date(Number(deadline) * 1000).toLocaleString()
const formatToken = (value: bigint) => Number(formatEther(value)).toLocaleString(undefined, {
  maximumFractionDigits: 4,
})

const marketStatus = (market: MarketView) => {
  if (market.resolved) {
    return 'Resolved'
  }

  const deadlineMs = Number(market.deadline) * 1000
  return Date.now() >= deadlineMs ? 'Closed' : 'Open'
}

const marketStatusClass = (market: MarketView) => {
  const statusLabel = marketStatus(market)
  if (statusLabel === 'Resolved') {
    return 'badge-resolved'
  }

  if (statusLabel === 'Closed') {
    return 'badge-closed'
  }

  return 'badge-open'
}

const winningOutcomeName = (market: MarketView) => {
  const outcome = market.outcomes.find((candidate) => candidate.id === Number(market.winningOutcomeId))
  return outcome?.name ?? 'Unknown'
}

const marketIsInactive = (market: MarketView) => {
  return market.resolved || marketStatus(market) === 'Closed'
}

const parseStakeAmount = (marketId: number) => {
  const rawInput = marketStakeInputs[marketId]
  const rawValue = typeof rawInput === 'string'
    ? rawInput.trim()
    : String(rawInput ?? '').trim()

  if (!rawValue) {
    throw new Error('Enter a stake amount')
  }

  return parseEther(rawValue)
}

const refreshMarkets = async () => {
  if (!account.value) {
    markets.value = []
    return
  }

  const rawMarkets = await getMarkets()
  const nextMarkets: MarketView[] = []

  for (const market of rawMarkets) {
    const claimed = await hasClaimedReward(market.id, account.value)

    nextMarkets.push({
      ...market,
      claimed,
    })

    if (!marketStakeInputs[market.id]) {
      marketStakeInputs[market.id] = '10'
    }
  }

  markets.value = nextMarkets
}

const refreshDashboard = async () => {
  if (!account.value) {
    return
  }

  try {
    loading.value = true
    status.value = ''

    const [balance, currentAllowance] = await Promise.all([
      getVoteBalance(account.value),
      getAllowance(account.value),
    ])

    voteBalance.value = balance
    allowance.value = currentAllowance

    await refreshMarkets()
  } catch (error) {
    status.value = error instanceof Error ? error.message : 'Failed to load market data'
  } finally {
    loading.value = false
  }
}

const connectWallet = async () => {
  try {
    status.value = 'Connecting wallet...'
    await connect()
    await refreshDashboard()
    status.value = 'Wallet connected.'
  } catch (error) {
    status.value = error instanceof Error ? error.message : 'Could not connect wallet'
  }
}

const claimFaucetAction = async () => {
  try {
    status.value = 'Claiming faucet...'
    const tx = await claimFaucet()
    await tx.wait()
    status.value = 'Faucet claimed.'
    await refreshDashboard()
  } catch (error) {
    status.value = error instanceof Error ? error.message : 'Could not claim faucet'
  }
}

const submitMarket = async () => {
  try {
    if (!marketForm.question.trim()) {
      status.value = 'Question is required'
      return
    }

    if (!marketForm.resolutionContext.trim()) {
      status.value = 'Resolution context is required'
      return
    }

    const durationInSeconds = marketForm.durationUnit === 'minutes'
      ? marketForm.duration * 60
      : marketForm.duration

    if (durationInSeconds <= 0) {
      status.value = 'Duration must be positive'
      return
    }

    status.value = 'Creating market...'
    const tx = await createMarket(
      marketForm.question.trim(),
      ['YES', 'NO'],
      durationInSeconds,
      marketForm.resolutionContext.trim()
    )
    await tx.wait()

    marketForm.question = ''
    marketForm.duration = 30
    marketForm.durationUnit = 'minutes'
    marketForm.resolutionContext = ''

    status.value = 'Market created.'
    await refreshDashboard()
  } catch (error) {
    status.value = error instanceof Error ? error.message : 'Could not create market'
  }
}

const approveForMarket = async (marketId: number) => {
  try {
    const amount = parseStakeAmount(marketId)
    status.value = 'Approving VOTE...'
    const tx = await approvePredictionMarket(amount)
    await tx.wait()
    status.value = 'Allowance approved.'
    await refreshDashboard()
  } catch (error) {
    status.value = error instanceof Error ? error.message : 'Could not approve allowance'
  }
}

const stakeOnMarket = async (marketId: number, outcomeId: number) => {
  try {
    const amount = parseStakeAmount(marketId)

    if (allowance.value < amount) {
      status.value = 'Approve VOTE first.'
      return
    }

    status.value = `Staking on ${outcomeId === 0 ? 'YES' : 'NO'}...`
    const tx = await stake(marketId, outcomeId, amount)
    await tx.wait()

    status.value = 'Stake submitted.'
    await refreshDashboard()
  } catch (error) {
    status.value = error instanceof Error ? error.message : 'Could not place stake'
  }
}

const resolveMarketAs = async (marketId: number, winningOutcomeId: number) => {
  try {
    status.value = 'Resolving market...'
    const tx = await resolveMarket(marketId, winningOutcomeId)
    await tx.wait()
    status.value = 'Market resolved.'
    await refreshDashboard()
  } catch (error) {
    status.value = error instanceof Error ? error.message : 'Could not resolve market'
  }
}

const claimMarketReward = async (marketId: number) => {
  try {
    status.value = 'Claiming reward...'
    const tx = await claimReward(marketId)
    await tx.wait()
    status.value = 'Reward claimed.'
    await refreshDashboard()
  } catch (error) {
    status.value = error instanceof Error ? error.message : 'Could not claim reward'
  }
}

onMounted(async () => {
  const connected = await refreshConnection()
  if (connected) {
    await refreshDashboard()
  }
})

watch(status, (nextStatus, previousStatus) => {
  if (!nextStatus || nextStatus === previousStatus) {
    return
  }

  pushNotification(nextStatus)
})

watch(account, async (nextAccount, previousAccount) => {
  const switchedAccount =
    !!nextAccount &&
    !!previousAccount &&
    nextAccount.toLowerCase() !== previousAccount.toLowerCase()

  if (switchedAccount || (!nextAccount && !!previousAccount)) {
    clearNotificationHistory()
    showNotificationPanel.value = false
  }

  if (nextAccount) {
    await refreshDashboard()
  }
})
</script>

<template>
  <main class="shell">
    <div class="orb orb-one"></div>
    <div class="orb orb-two"></div>

    <section class="hero panel">
      <div class="hero-copy">
        <p class="eyebrow">Simplified prediction market</p>
        <h1>Shared VOTE, pooled outcomes, and admin resolution.</h1>
        <p class="lede">
          Claim VOTE from the faucet, create a market, stake on YES or NO, and let the admin resolve after the deadline.
          Probabilities come directly from the pool split.
        </p>
      </div>

      <div class="wallet-card">
        <div class="wallet-head">
          <span class="wallet-label">Wallet</span>
          <div class="wallet-right">
            <span class="network-pill">Hardhat localhost</span>
            <button
              v-if="account"
              class="bell-button"
              @click="toggleNotifications"
              title="Notification history"
              aria-label="Notification history"
            >
              <span>🔔</span>
              <span v-if="unreadNotificationCount > 0" class="bell-badge">{{ unreadNotificationCount }}</span>
            </button>
          </div>
        </div>

        <button class="primary-button" @click="connectWallet">
          {{ hasWallet ? 'Reconnect Wallet' : 'Connect Wallet' }}
        </button>

        <div v-if="account" class="wallet-meta">
          <p><span>Address</span><strong>{{ account }}</strong></p>
          <p><span>Chain</span><strong>{{ chainId }}</strong></p>
          <p><span>VOTE balance</span><strong>{{ formatToken(voteBalance) }}</strong></p>
          <p><span>Allowance</span><strong>{{ formatToken(allowance) }}</strong></p>
        </div>

        <button v-if="account && !isAdmin" class="secondary-button" @click="claimFaucetAction">
          Claim 1000 VOTE
        </button>
      </div>
    </section>

    <section v-if="!isAdmin" class="panel form-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Create market</p>
          <h2>YES / NO demo market</h2>
        </div>
        <button class="ghost-button" @click="refreshDashboard" :disabled="loading || !account">
          Refresh
        </button>
      </div>

      <div class="form-grid">
        <label>
          <span>Question</span>
          <input v-model="marketForm.question" type="text" placeholder="Will ETH be above 5000 USD on 01.07.2026?" />
        </label>

        <label>
          <span>Duration</span>
          <div class="inline-fields">
            <input v-model.number="marketForm.duration" type="number" min="1" />
            <select v-model="marketForm.durationUnit">
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
            </select>
          </div>
        </label>
      </div>

      <label>
        <span>Resolution context</span>
        <textarea
          v-model="marketForm.resolutionContext"
          rows="4"
          placeholder="Resolve YES if the source price is above the threshold at the deadline."
        ></textarea>
      </label>

      <div class="form-actions">
        <button class="primary-button" @click="submitMarket" :disabled="!account">
          Create Market
        </button>
        <p class="hint">Outcomes are fixed to YES and NO for the MVP.</p>
      </div>
    </section>

    <section class="panel market-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Markets</p>
          <h2>All live and resolved markets</h2>
        </div>
        <p class="hint">Admin: {{ Addresses.admin }}</p>
      </div>

      <div v-if="!account" class="empty-state">
        Connect a wallet to load markets, balances, and staking actions.
      </div>

      <div v-else-if="markets.length === 0" class="empty-state">
        No markets yet. Create the first one above.
      </div>

      <div v-else class="market-list">
        <article v-for="market in markets" :key="market.id" class="market-card">
          <div class="market-top">
            <div>
              <p class="market-id">Market #{{ market.id }}</p>
              <h3>{{ market.question }}</h3>
            </div>
            <span class="status-pill" :class="marketStatusClass(market)">
              {{ marketStatus(market) }}
            </span>
          </div>

          <p class="context">{{ market.resolutionContext }}</p>

          <div class="meta-grid">
            <div>
              <span>Total pool</span>
              <strong>{{ formatToken(market.totalPool) }} VOTE</strong>
            </div>
            <div>
              <span>Deadline</span>
              <strong>{{ formatDeadline(market.deadline) }}</strong>
            </div>
            <div>
              <span>Creator</span>
              <strong>{{ market.creator }}</strong>
            </div>
            <div v-if="market.resolved">
              <span>Winner</span>
              <strong>{{ winningOutcomeName(market) }}</strong>
            </div>
          </div>

          <div class="outcomes-grid">
            <div v-for="outcome in market.outcomes" :key="outcome.id" class="outcome-card">
              <div class="outcome-head">
                <strong>{{ outcome.name }}</strong>
                <span>{{ formatBps(outcome.probabilityBps) }}</span>
              </div>
              <p>{{ formatToken(outcome.pool) }} VOTE pooled</p>
            </div>
          </div>

          <div v-if="!isAdmin" class="stake-block">
            <label>
              <span>Stake amount</span>
              <input
                v-model="marketStakeInputs[market.id]"
                type="number"
                min="0"
                step="0.01"
                inputmode="decimal"
                :disabled="marketIsInactive(market)"
              />
            </label>

            <div class="action-row">
              <button
                class="secondary-button"
                @click="approveForMarket(market.id)"
                :disabled="marketIsInactive(market)"
                :title="marketIsInactive(market) ? 'Market closed or resolved' : 'Approve VOTE'"
              >
                Approve VOTE
              </button>
              <button
                class="primary-button"
                @click="stakeOnMarket(market.id, 0)"
                :disabled="marketIsInactive(market)"
                :title="marketIsInactive(market) ? 'Market closed or resolved' : 'Stake YES'"
              >
                Stake YES
              </button>
              <button
                class="primary-button"
                @click="stakeOnMarket(market.id, 1)"
                :disabled="marketIsInactive(market)"
                :title="marketIsInactive(market) ? 'Market closed or resolved' : 'Stake NO'"
              >
                Stake NO
              </button>
            </div>
          </div>

          <div v-if="isAdmin && !market.resolved" class="resolve-block">
            <button class="secondary-button" @click="resolveMarketAs(market.id, 0)">
              Resolve as YES
            </button>
            <button class="secondary-button" @click="resolveMarketAs(market.id, 1)">
              Resolve as NO
            </button>
          </div>

          <div v-if="market.resolved && !isAdmin" class="claim-block">
            <span v-if="market.claimed" class="claimed-pill">Reward claimed</span>
            <button v-else class="primary-button" @click="claimMarketReward(market.id)">
              Claim reward
            </button>
          </div>
        </article>
      </div>
    </section>

    <div
      v-if="account && showNotificationPanel"
      class="notif-overlay"
      @click.self="closeNotifications"
    >
      <section class="notif-modal" role="dialog" aria-modal="true" aria-label="Notification history">
        <div class="notif-head">
          <strong>Notification history</strong>
          <div class="notif-actions">
            <button class="ghost-button" @click="clearNotificationHistory" :disabled="notifications.length === 0">
              Delete history
            </button>
            <button class="ghost-button" @click="closeNotifications" aria-label="Close notification history">
              Close
            </button>
          </div>
        </div>

        <p v-if="notifications.length === 0" class="notif-empty">No notifications yet.</p>

        <ul v-else class="notif-list">
          <li v-for="entry in notifications" :key="entry.id" class="notif-item">
            <span class="notif-dot" :class="`tone-${entry.tone}`"></span>
            <div class="notif-body">
              <p>{{ entry.message }}</p>
              <span>{{ formatNotificationTime(entry.createdAt) }}</span>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <div v-if="toastVisible" class="toast-popup">{{ toastMessage }}</div>
    <!-- <p class="status-line" v-if="status">{{ status }}</p> -->
  </main>
</template>

<style scoped>
:global(body) {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(250, 204, 21, 0.16), transparent 34%),
    radial-gradient(circle at top right, rgba(56, 189, 248, 0.18), transparent 30%),
    linear-gradient(180deg, #07111f 0%, #0b1628 50%, #050b14 100%);
  color: #edf3ff;
  font-family: 'Trebuchet MS', 'Segoe UI', sans-serif;
}

.shell {
  position: relative;
  max-width: 1180px;
  margin: 0 auto;
  padding: 32px 20px 60px;
}

.orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(20px);
  opacity: 0.4;
  pointer-events: none;
}

.orb-one {
  top: 60px;
  left: -120px;
  width: 220px;
  height: 220px;
  background: rgba(250, 204, 21, 0.25);
}

.orb-two {
  right: -80px;
  top: 240px;
  width: 180px;
  height: 180px;
  background: rgba(56, 189, 248, 0.22);
}

.panel {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(8, 15, 28, 0.78);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(14px);
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(320px, 0.9fr);
  gap: 24px;
  padding: 28px;
  border-radius: 28px;
  margin-bottom: 20px;
}

.hero-copy h1 {
  margin: 10px 0 12px;
  font-size: clamp(2.4rem, 5vw, 4.4rem);
  line-height: 0.95;
  letter-spacing: -0.04em;
  max-width: 11ch;
}

.lede {
  max-width: 58ch;
  margin: 0;
  color: #c8d3e3;
  line-height: 1.6;
}

.eyebrow {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-size: 0.74rem;
  color: #fbbf24;
}

.wallet-card,
.form-panel,
.market-panel {
  border-radius: 24px;
  padding: 22px;
}

.wallet-card {
  align-self: start;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(3, 7, 18, 0.9));
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.wallet-head,
.section-head,
.market-top,
.outcome-head,
.form-actions,
.action-row,
.resolve-block,
.claim-block {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.wallet-label,
.market-id,
.context,
.hint,
.meta-grid span,
.wallet-meta span {
  color: #8ea0bb;
}

.wallet-meta {
  display: grid;
  gap: 10px;
}

.wallet-meta p,
.meta-grid div,
.outcome-card p {
  margin: 0;
}

.wallet-meta strong,
.meta-grid strong {
  display: block;
  margin-top: 3px;
  color: #eef5ff;
  font-weight: 600;
  word-break: break-word;
}

.network-pill,
.status-pill,
.claimed-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 700;
}

.network-pill {
  background: rgba(56, 189, 248, 0.14);
  color: #8edcf8;
}

.status-pill {
  min-width: 84px;
  justify-content: center;
}

.badge-open {
  background: rgba(34, 197, 94, 0.14);
  color: #8df0ab;
}

.badge-closed {
  background: rgba(250, 204, 21, 0.14);
  color: #f7db78;
}

.badge-resolved {
  background: rgba(168, 85, 247, 0.16);
  color: #d8b4fe;
}

.primary-button,
.secondary-button,
.ghost-button {
  border: 0;
  border-radius: 14px;
  padding: 12px 16px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.2s ease, background 0.2s ease;
}

.primary-button:hover,
.secondary-button:hover,
.ghost-button:hover {
  transform: translateY(-1px);
}

.primary-button {
  background: linear-gradient(135deg, #fbbf24, #fb7185);
  color: #0b1020;
}

.secondary-button {
  background: rgba(148, 163, 184, 0.14);
  color: #edf3ff;
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.ghost-button {
  background: transparent;
  color: #d7e2f2;
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.primary-button:disabled,
.secondary-button:disabled,
.ghost-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.form-panel,
.market-panel {
  margin-top: 20px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1.6fr 0.8fr;
  gap: 14px;
  margin: 18px 0 14px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

input,
select,
textarea {
  width: 100%;
  box-sizing: border-box;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.78);
  color: #edf3ff;
  padding: 12px 14px;
  font: inherit;
}

input:focus,
select:focus,
textarea:focus {
  outline: 2px solid rgba(251, 191, 36, 0.36);
  outline-offset: 2px;
}

.inline-fields {
  display: grid;
  grid-template-columns: 1fr 0.8fr;
  gap: 10px;
}

.form-actions {
  margin-top: 16px;
  align-items: center;
  justify-content: flex-start;
}

.empty-state {
  padding: 20px 0 6px;
  color: #a8b7cd;
}

.market-list {
  display: grid;
  gap: 16px;
  margin-top: 16px;
}

.market-card {
  border-radius: 22px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(11, 18, 32, 0.84);
  padding: 18px;
}

.market-card h3 {
  margin: 8px 0 0;
  font-size: 1.35rem;
  line-height: 1.2;
}

.context {
  margin: 14px 0 0;
  line-height: 1.55;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 16px;
}

.meta-grid div,
.outcome-card,
.stake-block,
.resolve-block,
.claim-block {
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(15, 23, 42, 0.58);
  padding: 14px;
}

.outcomes-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 14px;
}

.outcome-head span {
  color: #f5d06a;
  font-weight: 700;
}

.stake-block {
  margin-top: 14px;
}

.stake-block label {
  margin-bottom: 14px;
}

.action-row,
.resolve-block,
.claim-block {
  flex-wrap: wrap;
  justify-content: flex-start;
}

.claimed-pill {
  background: rgba(34, 197, 94, 0.14);
  color: #8df0ab;
}

.wallet-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bell-button {
  position: relative;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(15, 23, 42, 0.75);
  color: #edf3ff;
  border-radius: 10px;
  padding: 6px 10px;
  cursor: pointer;
}

.bell-badge {
  position: absolute;
  top: -7px;
  right: -7px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: #fb7185;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.notif-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.66);
  backdrop-filter: blur(3px);
  display: grid;
  place-items: center;
  padding: 16px;
  z-index: 980;
}

.notif-modal {
  width: min(760px, 100%);
  max-height: min(78vh, 720px);
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 16px;
  background: rgba(3, 9, 22, 0.96);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
  padding: 14px;
  overflow: hidden;
}

.notif-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.notif-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.notif-empty {
  margin: 12px 0 4px;
  color: #a8b7cd;
}

.notif-list {
  list-style: none;
  padding: 0;
  margin: 12px 0 0;
  display: grid;
  gap: 8px;
  max-height: min(62vh, 580px);
  overflow-y: auto;
}

.notif-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: rgba(15, 23, 42, 0.64);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 10px;
  padding: 8px;
}

.notif-dot {
  margin-top: 4px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex: 0 0 auto;
}

.tone-info {
  background: #8edcf8;
}

.tone-success {
  background: #8df0ab;
}

.tone-error {
  background: #fda4af;
}

.notif-body p {
  margin: 0;
  color: #edf3ff;
}

.notif-body span {
  margin-top: 4px;
  display: inline-block;
  font-size: 0.78rem;
  color: #8ea0bb;
}

.toast-popup {
  position: fixed;
  right: 18px;
  bottom: 24px;
  background: linear-gradient(135deg, #fbbf24, #fb7185);
  color: #0b1020;
  border-radius: 12px;
  padding: 10px 14px;
  font-weight: 700;
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.35);
  z-index: 999;
}

.status-line {
  margin: 18px 4px 0;
  color: #f8d57a;
}

@media (max-width: 920px) {
  .hero,
  .form-grid,
  .outcomes-grid,
  .meta-grid {
    grid-template-columns: 1fr;
  }

  .hero {
    padding: 22px;
  }
}
</style>
