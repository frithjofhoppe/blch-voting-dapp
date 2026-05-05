<script setup lang="ts">
const { account, chainId, connect, refreshConnection } = useWallet()
const { 
  getTokenBallotContract,
  getActiveBallot,
  isBallotExpired,
  getBallotDeadline,
  createNewBallot,
  getBallotManagerContract,
  getVoteTokenForBallot
} = useContracts()

const tokenBalance = ref<string | null>(null)
const ballotTitle = ref<string | null>(null)
const ballotNumber = ref<number>(1)
const options = ref<{ name: string; votes: string }[]>([])
const selectedOption = ref<number>(0)
const status = ref<string>('')
const isAdmin = ref<boolean>(false)
const ballotExpired = ref<boolean>(false)
const deadline = ref<number | null>(null)
const currentBallotAddress = ref<string | null>(null)

// Create ballot form state
const showCreateBallotForm = ref<boolean>(false)
const newBallotTitle = ref<string>('')
const newBallotOptions = ref<string[]>(['', ''])
const newBallotVoters = ref<string[]>(['', '', ''])
const newBallotDuration = ref<number>(120)
const creatingBallot = ref<boolean>(false)
const canCreateNewBallot = computed(() => isAdmin.value && ballotExpired.value)

onMounted(() => {
  void refreshConnection().then((hasAccount) => {
    if (hasAccount) {
      void loadDAppData()
    }
  })

  if (account.value) {
    void loadDAppData()
  }
})

watch(account, () => {
  if (account.value) {
    void loadDAppData()
  }
})

const loadDAppData = async () => {
  if (!account.value) return

  try {
    // Get active ballot from manager
    const activeBallot = await getActiveBallot()
    currentBallotAddress.value = activeBallot

    const manager = await getBallotManagerContract()
    const deadlineValue = await manager.getBallotDeadline(activeBallot)
    deadline.value = Number(deadlineValue)

    // Check if ballot is expired
    const expired = await isBallotExpired(activeBallot)
    ballotExpired.value = expired

    // Check if current account is admin
    const adminAddress = await manager.admin()
    isAdmin.value = adminAddress.toLowerCase() === account.value.toLowerCase()

    const voteToken = await getVoteTokenForBallot(activeBallot)
    const ballot = await getTokenBallotContract(activeBallot)

    const balance = await voteToken.balanceOf(account.value)
    tokenBalance.value = balance.toString()

    ballotTitle.value = await ballot.title()

    const optionCount = await ballot.getOptionCount()
    const loadedOptions: { name: string; votes: string }[] = []

    for (let i = 0; i < Number(optionCount); i++) {
      const option = await ballot.getOption(i)

      loadedOptions.push({
        name: option[0],
        votes: option[1].toString()
      })
    }

    options.value = loadedOptions
  } catch (error) {
    status.value = error instanceof Error ? error.message : 'Could not load ballot data'
  }
}

const connectWallet = async () => {
  try {
    status.value = 'Connecting wallet...'
    await connect()
    await loadDAppData()
    status.value = 'Wallet connected.'
  } catch (error) {
    status.value = error instanceof Error ? error.message : 'Could not connect wallet'
  }
}

const vote = async () => {
  try {
    status.value = 'Approving token transfer...'

    const ballotAddress = currentBallotAddress.value
    if (!ballotAddress) {
      throw new Error('No active ballot loaded')
    }

    const voteToken = await getVoteTokenForBallot(ballotAddress)
    const ballot = await getTokenBallotContract(ballotAddress)
    const ballotContractAddress = await ballot.getAddress()

    const approveTx = await voteToken.approve(ballotContractAddress, 1)
    await approveTx.wait()

    status.value = 'Submitting vote...'

    const voteTx = await ballot.vote(selectedOption.value, 1)
    await voteTx.wait()

    status.value = 'Vote submitted.'
    await loadDAppData()
  } catch (error) {
    status.value = error instanceof Error ? error.message : 'Voting failed'
  }
}

const winner = ref<{ index: string; name: string; votes: string } | null>(null)

const loadWinner = async () => {
  try {
    if (!ballotExpired.value) {
      status.value = 'Voting is still open. Wait for the ballot to expire before showing the final result.'
      return
    }

    status.value = 'Loading final result...'

    const ballot = await getTokenBallotContract(currentBallotAddress.value!)
    const result = await ballot.getWinner()

    winner.value = {
      index: result[0].toString(),
      name: result[1],
      votes: result[2].toString()
    }

    status.value = 'Final result loaded.'
  } catch (error) {
    status.value = error instanceof Error
      ? error.message
      : 'Could not load winner. Voting may still be open.'
  }
}

const addBallotOption = () => {
  newBallotOptions.value.push('')
}

const removeBallotOption = (index: number) => {
  if (newBallotOptions.value.length > 2) {
    newBallotOptions.value.splice(index, 1)
  }
}

const addBallotVoter = () => {
  newBallotVoters.value.push('')
}

const removeBallotVoter = (index: number) => {
  newBallotVoters.value.splice(index, 1)
}

const submitCreateBallot = async () => {
  try {
    // Validate inputs
    const filledOptions = newBallotOptions.value.filter(opt => opt.trim() !== '')
    const filledVoters = newBallotVoters.value.filter(voter => voter.trim() !== '')

    if (filledOptions.length < 2) {
      status.value = 'Please provide at least 2 voting options'
      return
    }

    if (filledVoters.length < 1) {
      status.value = 'Please provide at least 1 voter address'
      return
    }

    if (newBallotDuration.value <= 0) {
      status.value = 'Duration must be greater than 0'
      return
    }

    creatingBallot.value = true
    status.value = 'Creating new ballot...'

    const tx = await createNewBallot(
      newBallotTitle.value || 'New Ballot',
      filledOptions,
      filledVoters,
      newBallotDuration.value
    )

    await tx.wait()

    status.value = 'New ballot created successfully!'
    showCreateBallotForm.value = false

    // Reset form
    newBallotTitle.value = ''
    newBallotOptions.value = ['', '']
    newBallotVoters.value = ['', '', '']
    newBallotDuration.value = 120
    ballotNumber.value += 1

    // Reload data
    await loadDAppData()
  } catch (error) {
    status.value = error instanceof Error ? error.message : 'Failed to create ballot'
  } finally {
    creatingBallot.value = false
  }
}
</script>

<template>
  <main class="min-h-screen bg-slate-950 text-white p-8">
    <section class="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 class="text-3xl font-bold">
          Token Voting DApp
        </h1>
        <p class="mt-2 text-slate-300">
          Connect MetaMask, check your VOTE balance, and vote for one option.
        </p>
      </header>

      <section class="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
        <button
          class="rounded-lg bg-white px-4 py-2 font-medium text-slate-950"
          @click="connectWallet"
        >
          Connect MetaMask
        </button>

        <div v-if="account" class="space-y-1 text-sm text-slate-300">
          <p><strong>Account:</strong> {{ account }}</p>
          <p><strong>Chain ID:</strong> {{ chainId }}</p>
          <p><strong>VOTE balance:</strong> {{ tokenBalance }}</p>
        </div>
      </section>

      <section
        v-if="ballotTitle"
        class="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4"
      >
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-semibold">
              Ballot #{{ ballotNumber }}
            </h2>
            <p class="text-sm text-slate-400">{{ ballotTitle }}</p>
          </div>
          <div v-if="ballotExpired" class="px-3 py-1 rounded-full bg-red-900 text-red-200 text-sm font-medium">
            Expired
          </div>
          <div v-else class="px-3 py-1 rounded-full bg-green-900 text-green-200 text-sm font-medium">
            Voting Open
          </div>
        </div>

        <p class="text-sm text-slate-400">
          Deadline: {{ deadline ? new Date(deadline * 1000).toLocaleString() : 'Unknown' }}
        </p>

        <div class="space-y-3">
          <label
            v-for="(option, index) in options"
            :key="option.name"
            class="flex cursor-pointer items-center justify-between rounded-lg border border-slate-700 p-4 hover:bg-slate-800"
            :class="{ 'opacity-50 cursor-not-allowed': ballotExpired }"
          >
            <div class="flex items-center gap-3">
              <input
                v-model="selectedOption"
                type="radio"
                :value="index"
                :disabled="ballotExpired"
              >
              <span>{{ option.name }}</span>
            </div>

            <span class="text-slate-400">
              {{ option.votes }} votes
            </span>
          </label>
        </div>

        <button
          v-if="!ballotExpired"
          class="rounded-lg bg-emerald-400 px-4 py-2 font-medium text-slate-950 hover:bg-emerald-300"
          @click="vote"
        >
          Vote with 1 VOTE
        </button>
        <p v-else class="text-sm text-slate-400">
          Voting is closed for this ballot.
        </p>
      </section>

      <!-- Admin create ballot button -->
      <section v-if="isAdmin" class="rounded-xl border border-orange-800 bg-orange-900 bg-opacity-20 p-6 space-y-4">
        <h3 class="text-lg font-semibold text-orange-300">Admin Controls</h3>
        <p v-if="ballotExpired" class="text-sm text-slate-300">The current ballot has expired. You can create a new one.</p>
        <p v-else class="text-sm text-slate-300">The current ballot is still open. New ballot creation becomes available after expiry.</p>
        <button
          v-if="!showCreateBallotForm"
          :disabled="!canCreateNewBallot"
          class="rounded-lg bg-orange-500 px-4 py-2 font-medium text-slate-950 hover:bg-orange-400"
          @click="showCreateBallotForm = true"
        >
          {{ canCreateNewBallot ? 'Create New Ballot' : 'Create New Ballot (locked until expiry)' }}
        </button>

        <!-- Create ballot form -->
        <div v-if="showCreateBallotForm && canCreateNewBallot" class="space-y-4 mt-4">
          <div>
            <label class="block text-sm font-medium mb-1">Ballot Title</label>
            <input
              v-model="newBallotTitle"
              type="text"
              placeholder="Enter ballot title"
              class="w-full rounded-lg bg-slate-800 text-white px-3 py-2 border border-slate-700"
            >
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Voting Options</label>
            <div class="space-y-2">
              <div
                v-for="(option, index) in newBallotOptions"
                :key="index"
                class="flex gap-2"
              >
                <input
                  v-model="newBallotOptions[index]"
                  type="text"
                  :placeholder="`Option ${index + 1}`"
                  class="flex-1 rounded-lg bg-slate-800 text-white px-3 py-2 border border-slate-700"
                >
                <button
                  v-if="newBallotOptions.length > 2"
                  @click="removeBallotOption(index)"
                  class="rounded-lg bg-red-700 px-3 py-2 hover:bg-red-600"
                >
                  Remove
                </button>
              </div>
            </div>
            <button
              @click="addBallotOption"
              class="mt-2 rounded-lg bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
            >
              + Add Option
            </button>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Voter Addresses</label>
            <div class="space-y-2">
              <div
                v-for="(voter, index) in newBallotVoters"
                :key="index"
                class="flex gap-2"
              >
                <input
                  v-model="newBallotVoters[index]"
                  type="text"
                  placeholder="0x..."
                  class="flex-1 rounded-lg bg-slate-800 text-white px-3 py-2 border border-slate-700 text-sm font-mono"
                >
                <button
                  v-if="newBallotVoters.length > 1"
                  @click="removeBallotVoter(index)"
                  class="rounded-lg bg-red-700 px-3 py-2 hover:bg-red-600"
                >
                  Remove
                </button>
              </div>
            </div>
            <button
              @click="addBallotVoter"
              class="mt-2 rounded-lg bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
            >
              + Add Voter
            </button>
          </div>

          <div>
            <label class="block text-sm font-medium mb-1">Voting Duration (seconds)</label>
            <input
              v-model.number="newBallotDuration"
              type="number"
              min="1"
              class="w-full rounded-lg bg-slate-800 text-white px-3 py-2 border border-slate-700"
            >
          </div>

          <div class="flex gap-2 pt-2">
            <button
              :disabled="creatingBallot"
              class="flex-1 rounded-lg bg-orange-500 px-4 py-2 font-medium text-slate-950 hover:bg-orange-400 disabled:opacity-50"
              @click="submitCreateBallot"
            >
              {{ creatingBallot ? 'Creating...' : 'Create Ballot' }}
            </button>
            <button
              :disabled="creatingBallot"
              class="rounded-lg bg-slate-700 px-4 py-2 hover:bg-slate-600 disabled:opacity-50"
              @click="showCreateBallotForm = false"
            >
              Cancel
            </button>
          </div>
        </div>
      </section>

      <p
        v-if="status"
        class="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300"
      >
        {{ status }}
      </p>

      <button
        :disabled="!ballotExpired"
        class="rounded-lg bg-blue-400 px-4 py-2 font-medium text-slate-950 hover:bg-blue-300"
        @click="loadWinner"
      >
        {{ ballotExpired ? 'Show final result' : 'Show final result (available after expiry)' }}
      </button>

      <div
        v-if="winner"
        class="rounded-lg border border-blue-400 bg-blue-950 p-4"
      >
        <p class="font-semibold">
          Winner: {{ winner.name }}
        </p>
        <p class="text-sm text-slate-300">
          Option #{{ winner.index }} with {{ winner.votes }} votes.
        </p>
      </div>
    </section>
  </main>
</template>
