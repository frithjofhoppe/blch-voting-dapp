<script setup lang="ts">
const { account, chainId, connect } = useWallet()
const { getVoteTokenContract, getTokenBallotContract } = useContracts()

const tokenBalance = ref<string | null>(null)
const ballotTitle = ref<string | null>(null)
const options = ref<{ name: string; votes: string }[]>([])
const selectedOption = ref<number>(0)
const status = ref<string>('')

const loadDAppData = async () => {
  if (!account.value) return

  const voteToken = await getVoteTokenContract()
  const ballot = await getTokenBallotContract()

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

    const voteToken = await getVoteTokenContract()
    const ballot = await getTokenBallotContract()
    const ballotAddress = await ballot.getAddress()

    const approveTx = await voteToken.approve(ballotAddress, 1)
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
    status.value = 'Loading final result...'

    const ballot = await getTokenBallotContract()
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
        <h2 class="text-2xl font-semibold">
          {{ ballotTitle }}
        </h2>

        <div class="space-y-3">
          <label
            v-for="(option, index) in options"
            :key="option.name"
            class="flex cursor-pointer items-center justify-between rounded-lg border border-slate-700 p-4 hover:bg-slate-800"
          >
            <div class="flex items-center gap-3">
              <input
                v-model="selectedOption"
                type="radio"
                :value="index"
              >
              <span>{{ option.name }}</span>
            </div>

            <span class="text-slate-400">
              {{ option.votes }} votes
            </span>
          </label>
        </div>

        <button
          class="rounded-lg bg-emerald-400 px-4 py-2 font-medium text-slate-950"
          @click="vote"
        >
          Vote with 1 VOTE
        </button>
      </section>

      <p
        v-if="status"
        class="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300"
      >
        {{ status }}
      </p>


      <button
          class="rounded-lg bg-blue-400 px-4 py-2 font-medium text-slate-950"
          @click="loadWinner"
        >
          Show final result
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