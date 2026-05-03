import { Contract } from 'ethers'
import VoteTokenArtifact from '../contracts/VoteToken.json'
import TokenBallotArtifact from '../contracts/TokenBallot.json'
import Addresses from '../contracts/addresses.localhost.json'

export const useContracts = () => {
  const { getSigner } = useWallet()

  const getVoteTokenContract = async () => {
    const signer = await getSigner()

    return new Contract(
      Addresses.voteToken,
      VoteTokenArtifact.abi,
      signer
    )
  }

  const getTokenBallotContract = async () => {
    const signer = await getSigner()

    return new Contract(
      Addresses.tokenBallot,
      TokenBallotArtifact.abi,
      signer
    )
  }

  return {
    getVoteTokenContract,
    getTokenBallotContract
  }
}