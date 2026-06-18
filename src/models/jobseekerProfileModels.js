import mongoose from 'mongoose';
import { ProfileVisibility } from '../enums/masterDataEnums.js';
import { boostSchema, locationSnapshotSchema, objectId } from './sharedModels.js';

const jobseekerProfileSchema = new mongoose.Schema({
  userId: { type: objectId, ref: 'User', required: true, unique: true },
  avatarUrl: { type: String, default: null },
  profileVisibility: { type: String, enum: Object.values(ProfileVisibility), default: ProfileVisibility.PUBLIC },
  allowEmployerSearch: { type: Boolean, default: true },
  desiredJob: {
    careerGroupId: { type: objectId, ref: 'CareerGroup', default: null },
    careerId: { type: objectId, ref: 'Career', default: null },
    careerPositionId: { type: objectId, ref: 'CareerPosition', default: null },
    experienceLevelId: { type: objectId, ref: 'ExperienceLevel', default: null },
    salaryExpectationMillion: {
      min: { type: Number, default: null },
      max: { type: Number, default: null }
    },
    workLocations: { type: [locationSnapshotSchema], default: [] }
  },
  skills: [{ type: objectId, ref: 'Skill' }],
  boost: { type: boostSchema, default: () => ({}) },
  notificationSettings: { type: [mongoose.Schema.Types.Mixed], default: [] },
  searchHistory: {
    type: [{
      keyword: { type: String, required: true },
      searchedAt: { type: Date, default: Date.now }
    }],
    default: []
  }
}, { timestamps: true });

const JobseekerProfile = mongoose.model('JobseekerProfile', jobseekerProfileSchema, 'jobseeker_profiles');
export default JobseekerProfile;
