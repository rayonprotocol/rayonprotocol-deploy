const Web3 = require('web3'); // web 1.0.0
const Caver = require('caver-js');
const console = require('console');
var fs = require('fs');
var readlineSync = require('readline-sync');
var etherWallet = require('ethereumjs-wallet');

// Common functions
const importFromKeystore = (keystoreFilePath) => {
    const keystoreFilePathExists = fs.existsSync(keystoreFilePath); // check if keystore file exists
    console.log('Keystore file \'' + keystoreFilePath + '\'');
    if (keystoreFilePathExists) {
        // var keystorePassword = readlineSync.question(' password: ', { hideEchoBack: true });
        var keystorePassword = 'scion1234';
        console.log('');

        var keystore = fs.readFileSync(keystoreFilePath).toString();
        try {
            var wallet = etherWallet.fromV3(keystore, keystorePassword);
            return [wallet.getAddressString(), wallet.getPrivateKeyString()];
        } catch (exception) { // error
            if (exception.message == 'Key derivation failed - possibly wrong passphrase') { // wrong keystore file password
                throw 'Wrong keystore password.';
            } else { // unknown error
                console.log(exception);
            }
        }
    } else {// if not, error occurs
        throw 'File not exists.';
    }
}

const webInstances = (networks, networkName) => {
    switch (networkName) {
        case 'local':
            var web3 = new Web3(networks[networkName].url);
            var web3_eth = web3.eth;
            break;
        case 'ropsten':
            var web3 = new Web3(networks[networkName].url);
            var web3_eth = web3.eth;
            break;
        case 'klaytn':
            var web3 = new Caver(networks[networkName].url);
            var web3_eth = web3.klay;
            break;
        default:
            console.log('Wrong networkname: ' + networkName);
            process.exit(-1);
    }
    var gasPrice = networks[networkName].gasPrice;
    var gasLimit = networks[networkName].gas;

    return [web3, web3_eth, gasPrice, gasLimit];
}








// Envirionments
const networks = {
    local: { url: 'http://localhost:8545', gas: 90000000000, gasPrice: '1' },
    klaytn: { url: "http://192.168.3.102:8551", gas: 20000000, gasPrice: '25000000000' },
    ropsten: { url: 'https://ropsten.infura.io/H1k68oRrrO6mYsa4jmnC', gas: 5000000, gasPrice: '10000000000' }
}
if (process.argv.length != 4) {
    console.log('Wrong arguments.');
    console.log('Usage: $ node ' + process.argv[1].split('/').reverse()[0] + ' <network> <keystore file>');
    process.exit(-1);
}
const [web3, web3_eth, gasPrice, gasLimit] = webInstances(networks, process.argv[2]);
const [address, privateKey] = importFromKeystore(process.argv[3]);



// Main code
console.log('address: ' + address);
console.log('privatekey: ' + privateKey);
