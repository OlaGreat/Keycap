// Generated from contracts/out/PasskeyAccountFactory.sol/PasskeyAccountFactory.json — do not hand-edit.
export const PasskeyAccountFactoryAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "_ownerValidator",
        "type": "address",
        "internalType": "contract IOwnerAuthValidator"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "createAccount",
    "inputs": [
      {
        "name": "ownerPubKeyX",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "ownerPubKeyY",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "salt",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getAddress",
    "inputs": [
      {
        "name": "ownerPubKeyX",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "ownerPubKeyY",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "salt",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "predicted",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ownerValidator",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IOwnerAuthValidator"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "AccountCreated",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "ownerPubKeyX",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "ownerPubKeyY",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "salt",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  }
] as const;
