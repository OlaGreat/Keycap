// Generated from contracts/out/ReasoningLog.sol/ReasoningLog.json — do not hand-edit.
export const ReasoningLogAbi = [
  {
    "type": "function",
    "name": "logReasoning",
    "inputs": [
      {
        "name": "callHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "reasoning",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "ReasoningLogged",
    "inputs": [
      {
        "name": "agent",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "callHash",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "reasoning",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  }
] as const;
