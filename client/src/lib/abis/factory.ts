export const factoryAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "token_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "identityGate_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "naming_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "treasury_",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "allPools",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "createPool",
    "inputs": [
      {
        "name": "cfg",
        "type": "tuple",
        "internalType": "struct ROSCAFactory.PoolConfig",
        "components": [
          {
            "name": "contribution",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "memberCount",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "periodSeconds",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "windowSeconds",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "minScore",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "acceptDefaulted",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "inviteOnly",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      },
      {
        "name": "creatorProof",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "pool",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "identityGate",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IIdentityGate"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isPool",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "naming",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IPoolNaming"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "poolCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "registry",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract ReputationRegistry"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setIdentityGate",
    "inputs": [
      {
        "name": "gate_",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setNaming",
    "inputs": [
      {
        "name": "naming_",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setRegistry",
    "inputs": [
      {
        "name": "registry_",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "token",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "treasury",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "IdentityGateSet",
    "inputs": [
      {
        "name": "gate",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "NamingSet",
    "inputs": [
      {
        "name": "naming",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PoolCreated",
    "inputs": [
      {
        "name": "pool",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "creator",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "poolId",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "config",
        "type": "tuple",
        "indexed": false,
        "internalType": "struct ROSCAFactory.PoolConfig",
        "components": [
          {
            "name": "contribution",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "memberCount",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "periodSeconds",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "windowSeconds",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "minScore",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "acceptDefaulted",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "inviteOnly",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RegistrySet",
    "inputs": [
      {
        "name": "registry",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "BelowMinMembers",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ExceedsCreatorTier",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotOwner",
    "inputs": []
  },
  {
    "type": "error",
    "name": "RegistryAlreadySet",
    "inputs": []
  },
  {
    "type": "error",
    "name": "RegistryNotSet",
    "inputs": []
  }
] as const;
