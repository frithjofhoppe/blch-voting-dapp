import { Contract, parseEther } from 'ethers'
import VoteTokenArtifact from '../contracts/VoteToken.json'
import PredictionMarketArtifact from '../contracts/PredictionMarket.json'
import Addresses from '../contracts/addresses.json'

type MarketSummary = {
  id: number
  creator: string
  question: string
  resolutionContext: string
  deadline: bigint
  resolved: boolean
  winningOutcomeId: bigint
  totalPool: bigint
  outcomes: Array<{
    id: number
    name: string
    pool: bigint
    probabilityBps: bigint
  }>
  stakers: Array<{
    address: string
    total: bigint
    outcomes: Array<{
      id: number
      amount: bigint
    }>
  }>
}

export const useContracts = () => {
  const { getSigner } = useWallet()

  const getVoteTokenContract = async () => {
    const signer = await getSigner()

    return new Contract(
      Addresses.voteToken,
      VoteTokenArtifact.abi,
      signer
    ) as any
  }

  const getPredictionMarketContract = async () => {
    const signer = await getSigner()

    return new Contract(
      Addresses.predictionMarket,
      PredictionMarketArtifact.abi,
      signer
    ) as any
  }

  const claimFaucet = async () => {
    const voteToken = await getVoteTokenContract()
    return await voteToken.claimFaucet()
  }

  const getVoteBalance = async (address: string) => {
    const voteToken = await getVoteTokenContract()
    return await voteToken.balanceOf(address)
  }

  const approvePredictionMarket = async (amount: bigint) => {
    const voteToken = await getVoteTokenContract()
    return await voteToken.approve(Addresses.predictionMarket, amount)
  }

  const getAllowance = async (owner: string) => {
    const voteToken = await getVoteTokenContract()
    return await voteToken.allowance(owner, Addresses.predictionMarket)
  }

  const createMarket = async (
    question: string,
    outcomes: string[],
    durationInSeconds: number,
    resolutionContext: string
  ) => {
    const predictionMarket = await getPredictionMarketContract()
    return await predictionMarket.createMarket(
      question,
      outcomes,
      durationInSeconds,
      resolutionContext
    )
  }

  const stake = async (
    marketId: bigint | number,
    outcomeId: bigint | number,
    amount: bigint
  ) => {
    const predictionMarket = await getPredictionMarketContract()
    return await predictionMarket.stake(marketId, outcomeId, amount)
  }

  const resolveMarket = async (
    marketId: bigint | number,
    winningOutcomeId: bigint | number
  ) => {
    const predictionMarket = await getPredictionMarketContract()
    return await predictionMarket.resolveMarket(marketId, winningOutcomeId)
  }

  const claimReward = async (marketId: bigint | number) => {
    const predictionMarket = await getPredictionMarketContract()
    return await predictionMarket.claimReward(marketId)
  }

  const getMarketCount = async () => {
    const predictionMarket = await getPredictionMarketContract()
    return await predictionMarket.getMarketCount()
  }

  const getMarket = async (marketId: bigint | number) => {
    const predictionMarket = await getPredictionMarketContract()
    return await predictionMarket.getMarket(marketId)
  }

  const getOutcomeCount = async (marketId: bigint | number) => {
    const predictionMarket = await getPredictionMarketContract()
    return await predictionMarket.getOutcomeCount(marketId)
  }

  const getOutcome = async (marketId: bigint | number, outcomeId: bigint | number) => {
    const predictionMarket = await getPredictionMarketContract()
    return await predictionMarket.getOutcome(marketId, outcomeId)
  }

  const getUserStake = async (
    marketId: bigint | number,
    user: string,
    outcomeId: bigint | number
  ) => {
    const predictionMarket = await getPredictionMarketContract()
    return await predictionMarket.getUserStake(marketId, user, outcomeId)
  }

  const getMarketStakers = async (marketId: bigint | number) => {
    const predictionMarket = await getPredictionMarketContract()
    return await predictionMarket.getMarketStakers(marketId)
  }

  const hasClaimedReward = async (marketId: bigint | number, user: string) => {
    const predictionMarket = await getPredictionMarketContract()
    return await predictionMarket.claimed(marketId, user)
  }

  const getMarkets = async (): Promise<MarketSummary[]> => {
    const marketCount = await getMarketCount()
    const markets: MarketSummary[] = []

    for (let marketId = 0n; marketId < marketCount; marketId += 1n) {
      const market = await getMarket(marketId)
      const outcomeCount = await getOutcomeCount(marketId)
      const outcomes: MarketSummary['outcomes'] = []
      const stakerAddresses = await getMarketStakers(marketId)
      const stakers: MarketSummary['stakers'] = []

      for (let outcomeId = 0n; outcomeId < outcomeCount; outcomeId += 1n) {
        const outcome = await getOutcome(marketId, outcomeId)

        outcomes.push({
          id: Number(outcomeId),
          name: outcome[0],
          pool: outcome[1],
          probabilityBps: outcome[2],
        })
      }

      for (const address of stakerAddresses) {
        const stakes = await Promise.all(
          outcomes.map(async (outcome) => ({
            id: outcome.id,
            amount: await getUserStake(marketId, address, outcome.id),
          }))
        )

        stakers.push({
          address,
          total: stakes.reduce((sum, stake) => sum + stake.amount, 0n),
          outcomes: stakes,
        })
      }

      markets.push({
        id: Number(marketId),
        creator: market[0],
        question: market[1],
        resolutionContext: market[2],
        deadline: market[3],
        resolved: market[4],
        winningOutcomeId: market[5],
        totalPool: market[6],
        outcomes,
        stakers,
      })
    }

    return markets
  }

  return {
    getVoteTokenContract,
    getPredictionMarketContract,
    claimFaucet,
    getVoteBalance,
    approvePredictionMarket,
    getAllowance,
    createMarket,
    stake,
    resolveMarket,
    claimReward,
    getMarketCount,
    getMarket,
    getOutcomeCount,
    getOutcome,
    getUserStake,
    getMarketStakers,
    hasClaimedReward,
    getMarkets,
    parseEther,
  }
}
