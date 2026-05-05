import { BrowserProvider } from 'ethers'

export const useWallet = () => {
  const account = useState<string | null>('wallet-account', () => null)
  const chainId = useState<string | null>('wallet-chain-id', () => null)

  const refreshConnection = async () => {
    if (!window.ethereum) {
      return false
    }

    const accounts = await window.ethereum.request({
      method: 'eth_accounts'
    }) as string[]

    if (accounts.length === 0) {
      account.value = null
      chainId.value = null
      return false
    }

    account.value = accounts[0]!
    chainId.value = await window.ethereum.request({
      method: 'eth_chainId'
    }) as string

    return true
  }

  const connect = async () => {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed')
    }

    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    }) as string[]

    if (accounts.length === 0) {
      throw new Error('No account selected')
    }

    account.value = accounts[0]!

    chainId.value = await window.ethereum.request({
      method: 'eth_chainId'
    }) as string
  }

  const getProvider = () => {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed')
    }

    return new BrowserProvider(window.ethereum)
  }

  const getSigner = async () => {
    const provider = getProvider()
    return provider.getSigner()
  }

  return {
    account,
    chainId,
    connect,
    refreshConnection,
    getProvider,
    getSigner
  }
}