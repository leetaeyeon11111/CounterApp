import { ethers } from 'ethers'
import { contractAddress } from './constants'
import CounterABI from './Counter.json'

// 컨트랙트 메서드들을 타입 안전하게 정의
interface CounterContractMethods {
  getCounter(): Promise<bigint>
  incrementCounter(): Promise<ethers.ContractTransactionResponse>
  decrementCounter(): Promise<ethers.ContractTransactionResponse>
  resetCounter(): Promise<ethers.ContractTransactionResponse>
  owner(): Promise<string>
}

export class CounterContractService {
  private contract: (ethers.Contract & CounterContractMethods) | null = null
  private provider: ethers.BrowserProvider | null = null
  private signer: ethers.JsonRpcSigner | null = null

  async connect(): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('이 함수는 브라우저에서만 실행할 수 있습니다.')
    }

    if (!window.ethereum) {
      throw new Error('MetaMask가 설치되지 않았습니다.')
    }

    try {
      // 먼저 지갑 연결 요청 (계정 승인)
      await window.ethereum.request({ method: 'eth_requestAccounts' })

      this.provider = new ethers.BrowserProvider(window.ethereum)
      this.signer = await this.provider.getSigner()

      // 네트워크 정보 가져오기
      const network = await this.provider.getNetwork()
      const chainId = Number(network.chainId)
      console.log('현재 네트워크:', network.name, 'Chain ID:', chainId)

      // Sepolia 네트워크 확인 (Chain ID: 11155111)
      const SEPOLIA_CHAIN_ID = '0xaa36a7' // 11155111 in hex
      const SEPOLIA_CHAIN_ID_DECIMAL = 11155111

      // 현재 Sepolia 네트워크가 아니라면 전환 요청
      if (chainId !== SEPOLIA_CHAIN_ID_DECIMAL) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: SEPOLIA_CHAIN_ID }],
          })
          console.log('Sepolia 네트워크로 전환 성공')
        } catch (switchError: any) {
          // 네트워크가 MetaMask에 없으면 추가
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: SEPOLIA_CHAIN_ID,
                  chainName: 'Sepolia',
                  nativeCurrency: {
                    name: 'ETH',
                    symbol: 'ETH',
                    decimals: 18,
                  },
                  rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
                  blockExplorerUrls: ['https://sepolia.etherscan.io'],
                },
              ],
            })
            console.log('Sepolia 네트워크 추가 및 전환 성공')
          } else {
            throw switchError
          }
        }

        // 네트워크 전환 후 provider 재생성 (중요!)
        this.provider = new ethers.BrowserProvider(window.ethereum)
        this.signer = await this.provider.getSigner()

        const updatedNetwork = await this.provider.getNetwork()
        console.log(
          '전환 후 네트워크:',
          updatedNetwork.name,
          'Chain ID:',
          Number(updatedNetwork.chainId)
        )
      }

      // Check if contract exists at the address
      const code = await this.provider.getCode(contractAddress)
      console.log('컨트랙트 코드:', code)

      if (code === '0x') {
        const errorMessage = `컨트랙트가 지정된 주소(${contractAddress})에 배포되지 않았습니다.\n현재 네트워크: ${network.name} (Chain ID: ${chainId})\nRemix에서 배포한 네트워크와 동일한지 확인하세요.`
        console.error(errorMessage)
        throw new Error(errorMessage)
      }

      this.contract = new ethers.Contract(
        contractAddress,
        CounterABI,
        this.signer
      ) as ethers.Contract & CounterContractMethods

      console.log('컨트랙트 연결 성공!')
    } catch (err) {
      if (err instanceof Error) {
        // 이미 연결된 경우 성공으로 처리
        if (err.message.includes('already pending')) {
          return
        }
        throw err
      }
      throw new Error('지갑 연결에 실패했습니다.')
    }
  }

  async getCounter(): Promise<bigint> {
    if (!this.contract || !this.provider) {
      throw new Error('컨트랙트에 연결되지 않았습니다.')
    }

    try {
      // For view functions, use the contract instance directly
      const result = await this.contract.getCounter()
      return result
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes('could not decode result data')
      ) {
        throw new Error(
          '컨트랙트에서 데이터를 읽을 수 없습니다. 잘못된 컨트랙트 주소 또는 네트워크일 수 있습니다.'
        )
      }
      throw err
    }
  }

  async incrementCounter(): Promise<void> {
    if (!this.contract) {
      throw new Error('컨트랙트에 연결되지 않았습니다.')
    }
    const tx = await this.contract.incrementCounter()
    await tx.wait()
  }

  async decrementCounter(): Promise<void> {
    if (!this.contract) {
      throw new Error('컨트랙트에 연결되지 않았습니다.')
    }
    const tx = await this.contract.decrementCounter()
    await tx.wait()
  }

  async resetCounter(): Promise<void> {
    if (!this.contract) {
      throw new Error('컨트랙트에 연결되지 않았습니다.')
    }
    const tx = await this.contract.resetCounter()
    await tx.wait()
  }

  async getOwner(): Promise<string> {
    if (!this.contract) {
      throw new Error('컨트랙트에 연결되지 않았습니다.')
    }

    try {
      // For view functions, use the contract instance directly
      return await this.contract.owner()
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes('could not decode result data')
      ) {
        throw new Error('컨트랙트 소유자 정보를 읽을 수 없습니다.')
      }
      throw err
    }
  }

  async getWalletAddress(): Promise<string> {
    if (!this.signer) {
      throw new Error('지갑에 연결되지 않았습니다.')
    }
    return await this.signer.getAddress()
  }

  async getNetwork(): Promise<ethers.Network> {
    if (!this.provider) {
      throw new Error('프로바이더에 연결되지 않았습니다.')
    }
    return await this.provider.getNetwork()
  }

  isConnected(): boolean {
    return this.contract !== null
  }
}

// 전역 인스턴스
export const counterService = new CounterContractService()
