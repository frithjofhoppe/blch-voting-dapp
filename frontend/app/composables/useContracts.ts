import { Contract } from 'ethers'
import BallotManagerArtifact from '../contracts/BallotManager.json'
import VoteTokenArtifact from '../contracts/VoteToken.json'
import TokenBallotArtifact from '../contracts/TokenBallot.json'
import Addresses from '../contracts/addresses.localhost.json'

export const useContracts = () => {
  const { getSigner } = useWallet()

  const getBallotManagerContract = async () => {
    const signer = await getSigner()

    return new Contract(
      Addresses.ballotManager,
      BallotManagerArtifact.abi,
      signer
    ) as any
  }

  const getVoteTokenContract = async (tokenAddress: string) => {
    const signer = await getSigner()

    return new Contract(
      tokenAddress,
      VoteTokenArtifact.abi,
      signer
    ) as any
  }

  const getTokenBallotContract = async (ballotAddress: string) => {
    const signer = await getSigner()

    return new Contract(
      ballotAddress,
      TokenBallotArtifact.abi,
      signer
    ) as any
  }

  /**
   * Get the VoteToken contract address for a ballot.
   */
  const getVoteTokenAddressForBallot = async (ballotAddress: string) => {
    const ballot = await getTokenBallotContract(ballotAddress)
    return await ballot.voteToken()
  }

  /**
   * Get the VoteToken contract for a specific ballot.
   */
  const getVoteTokenForBallot = async (ballotAddress: string) => {
    const signer = await getSigner()
    const tokenAddress = await getVoteTokenAddressForBallot(ballotAddress)

    return new Contract(
      tokenAddress,
      VoteTokenArtifact.abi,
      signer
    )
  }

  /**
   * Get the currently active ballot from BallotManager
   */
  const getActiveBallot = async () => {
    const manager = await getBallotManagerContract()
    return await manager.activeBallot()
  }

  /**
   * Check if a ballot is expired
   */
  const isBallotExpired = async (ballotAddress: string) => {
    const manager = await getBallotManagerContract()
    return await manager.isBallotExpired(ballotAddress)
  }

  /**
   * Get deadline timestamp for a ballot
   */
  const getBallotDeadline = async (ballotAddress: string) => {
    const manager = await getBallotManagerContract()
    return await manager.getBallotDeadline(ballotAddress)
  }

  /**
   * Get all ballots in history
   */
  const getAllBallots = async () => {
    const manager = await getBallotManagerContract()
    return await manager.getAllBallots()
  }

  /**
   * Create a new ballot via BallotManager
   */
  const createNewBallot = async (
    title: string,
    options: string[],
    voters: string[],
    durationInSeconds: number
  ) => {
    const manager = await getBallotManagerContract()
    return await manager.createBallot(title, options, voters, durationInSeconds)
  }

  return {
    getBallotManagerContract,
    getVoteTokenContract,
    getTokenBallotContract,
    getVoteTokenAddressForBallot,
    getVoteTokenForBallot,
    getActiveBallot,
    isBallotExpired,
    getBallotDeadline,
    getAllBallots,
    createNewBallot
  }
}