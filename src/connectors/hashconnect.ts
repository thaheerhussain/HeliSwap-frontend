import { HashConnect, HashConnectTypes, MessageTypes } from 'hashconnect';
import { Transaction, AccountId, TransactionId } from '@hashgraph/sdk';

class Hashconnect {
  constructor(
    setLoading: (loading: boolean) => void,
    setExtensionFound: (loading: boolean) => void,
    setConnected: (loading: boolean) => void,
  ) {
    this.hashconnect = new HashConnect();
    this.setLoading = setLoading;
    this.setExtensionFound = setExtensionFound;
    this.setConnected = setConnected;
  }

  hashconnect: HashConnect;
  status: string = 'Initializing';

  setLoading: (loading: boolean) => void;
  setExtensionFound: (loading: boolean) => void;
  setConnected: (loading: boolean) => void;

  availableExtensions: HashConnectTypes.WalletMetadata[] = [];

  saveData: {
    topic: string;
    pairingString: string;
    privateKey?: string;
    pairedWalletData?: HashConnectTypes.WalletMetadata;
    pairedAccounts: string[];
  } = {
    topic: '',
    pairingString: '',
    privateKey: undefined,
    pairedWalletData: undefined,
    pairedAccounts: [],
  };

  appMetadata: HashConnectTypes.AppMetadata = {
    name: 'HeliSwap DEX',
    description: 'HeliSwap DEX',
    icon: 'https://absolute.url/to/icon.png',
  };

  async initHashconnect() {
    //create the hashconnect instance
    this.hashconnect = new HashConnect(true);

    if (this.loadLocalData()) {
      await this.hashconnect.init(this.appMetadata, this.saveData.privateKey);
      await this.hashconnect.connect(this.saveData.topic, this.saveData.pairedWalletData!);

      this.setLoading(false);
      this.setExtensionFound(true);
      this.setConnected(true);
    } else {
      //first init, store the private key in localstorage
      const initData = await this.hashconnect.init(this.appMetadata);
      this.saveData.privateKey = initData.privKey;

      //then connect, storing the new topic in localstorage
      const state = await this.hashconnect.connect();
      this.saveData.topic = state.topic;

      //generate a pairing string, which you can display and generate a QR code from
      this.saveData.pairingString = this.hashconnect.generatePairingString(state, 'testnet', true);

      //find any supported local wallets
      this.hashconnect.findLocalWallets();
    }

    this.setUpEvents();
  }

  setUpEvents() {
    this.hashconnect.foundExtensionEvent.on(data => {
      this.availableExtensions.push(data);

      this.setLoading(false);
      this.setExtensionFound(true);
    });

    this.hashconnect.pairingEvent.on(data => {
      this.saveData.pairedWalletData = data.metadata;

      data.accountIds.forEach(id => {
        if (this.saveData.pairedAccounts.indexOf(id) === -1) this.saveData.pairedAccounts.push(id);
      });

      this.saveDataInLocalstorage();
      this.setLoading(false);
      this.setConnected(true);
    });

    this.hashconnect.transactionEvent.on(data => {
      //this will not be common to be used in a dapp
      console.log('transaction event callback');
    });
  }

  connect() {
    this.hashconnect.connectToLocalWallet(this.saveData.pairingString);
    this.setConnected(true);
  }

  disconnect() {
    this.saveData.pairedAccounts = [];
    this.saveData.pairedWalletData = undefined;
    localStorage.removeItem('hashconnectData');

    this.setConnected(false);
  }

  saveDataInLocalstorage() {
    let data = JSON.stringify(this.saveData);

    localStorage.setItem('hashconnectData', data);
  }

  loadLocalData(): boolean {
    let foundData = localStorage.getItem('hashconnectData');

    if (foundData) {
      this.saveData = JSON.parse(foundData);
      return true;
    } else return false;
  }

  async sendTransaction(trans: Uint8Array, acctToSign: string, return_trans: boolean = false) {
    const transaction: MessageTypes.Transaction = {
      topic: this.saveData.topic,
      byteArray: trans,

      metadata: {
        accountToSign: acctToSign,
        returnTransaction: return_trans,
      },
    };

    return await this.hashconnect.sendTransaction(this.saveData.topic, transaction);
  }

  async requestAccountInfo() {
    let request: MessageTypes.AdditionalAccountRequest = {
      topic: this.saveData.topic,
      network: 'mainnet',
      multiAccount: true,
    };

    await this.hashconnect.requestAdditionalAccounts(this.saveData.topic, request);
  }

  async makeBytes(trans: Transaction, signingAcctId: string) {
    let transId = TransactionId.generate(signingAcctId);
    trans.setTransactionId(transId);
    trans.setNodeAccountIds([new AccountId(3)]);

    await trans.freeze();

    let transBytes = trans.toBytes();

    return transBytes;
  }
}

export default Hashconnect;
