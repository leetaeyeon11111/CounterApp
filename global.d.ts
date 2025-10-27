// global.d.ts (프로젝트 루트 폴더)
import type { Eip1193Provider } from 'ethers'

declare global {
  interface Window {
    ethereum?: Eip1193Provider
  }
}

export {}
