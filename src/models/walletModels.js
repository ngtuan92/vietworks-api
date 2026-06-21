import mongoose from 'mongoose';
import { Currency } from '../enums/masterDataEnums.js';
import { WalletStatus } from '../enums/paymentEnums.js';
import { objectId } from './sharedModels.js';

const walletSchema = new mongoose.Schema({
  userId: { type: objectId, ref: 'User', required: true, unique: true },
  balance: { type: Number, default: 0 },
  totalDeposited: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  currency: { type: String, enum: Object.values(Currency), default: Currency.VND },
  status: { type: String, enum: Object.values(WalletStatus), default: WalletStatus.ACTIVE }
}, { timestamps: true });

const Wallet = mongoose.models.Wallet || mongoose.model('Wallet', walletSchema, 'wallets');
export default Wallet;
