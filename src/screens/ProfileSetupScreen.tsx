import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Image,
  TextInput,
  Alert,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import {
  Camera,
  User,
  Hash,
  BookOpen,
  Calendar,
  ArrowRight,
  ArrowLeft,
  Check,
  SkipForward,
  ImagePlus,
  UploadCloud,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { AppBackground } from '../components/AppBackground';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { studentService } from '../services/studentService';
import { uploadImageToCloudinary } from '../services/cloudinary';

const TOTAL_STEPS = 5;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ProfileSetupScreenProps {
  initialEmail?: string;
  onComplete: () => void;
}

export const ProfileSetupScreen: React.FC<ProfileSetupScreenProps> = ({
  initialEmail,
  onComplete,
}) => {
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [usn, setUsn] = useState('');
  const [department, setDepartment] = useState('');
  const [semester, setSemester] = useState('');

  // Photo & Cloudinary state
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [cloudinaryUrl, setCloudinaryUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [setupError, setSetupError] = useState('');

  // Stable animation values can be bound to styles without reading refs in render.
  const [fadeAnim] = useState(() => new Animated.Value(1));
  const [slideAnim] = useState(() => new Animated.Value(0));
  const [progressAnim] = useState(() => new Animated.Value(1 / TOTAL_STEPS));

  const departments = [
    'Computer Science',
    'Information Science',
    'Electronics & Comm.',
    'Electrical Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'Artificial Intelligence',
    'Data Science',
  ];

  const semesters = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: step / TOTAL_STEPS,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [step, progressAnim]);

  const animateTransition = (direction: 'forward' | 'back', callback: () => void) => {
    const exitValue = direction === 'forward' ? -30 : 30;
    const enterValue = direction === 'forward' ? 30 : -30;

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: false }),
      Animated.timing(slideAnim, { toValue: exitValue, duration: 120, useNativeDriver: false }),
    ]).start(() => {
      callback();
      slideAnim.setValue(enterValue);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
      ]).start();
    });
  };

  const goNext = () => {
    if (saving) return;
    setSetupError('');

    if (step === 2 && !fullName.trim()) {
      setSetupError('Please enter your full name to proceed.');
      return;
    }
    if (step === 3 && !usn.trim()) {
      setSetupError('Please enter your USN / Roll number to proceed.');
      return;
    }
    if (step === 4 && !department) {
      setDepartment('Computer Science');
    }
    if (step === 5 && !semester) {
      setSemester('3rd');
    }

    if (step < TOTAL_STEPS) {
      setStep((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const goBack = () => {
    if (step > 1) {
      setStep((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    if (step < TOTAL_STEPS) {
      setStep((prev) => prev + 1);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return true;
      case 2:
        return fullName.trim().length > 0;
      case 3:
        return usn.trim().length > 0;
      case 4:
        return department.length > 0;
      case 5:
        return semester.length > 0;
      default:
        return true;
    }
  };

  const handlePickPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Needed',
          'Please allow access to your photo library to select a profile photo.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const localUri = result.assets[0].uri;
        setPhotoUri(localUri);

        // Upload with a signed payload from the authenticated backend.
        setUploadingPhoto(true);
        setUploadProgress(20);
        try {
          const uploadedUrl = await uploadImageToCloudinary(localUri, (progress) => {
            setUploadProgress(progress);
          });
          setCloudinaryUrl(uploadedUrl);
        } catch (err: any) {
          console.warn('Cloudinary upload warning:', err.message);
          // Local photo still displays seamlessly
        } finally {
          setUploadingPhoto(false);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not select photo.');
    }
  };

  const handleFinish = async () => {
    setSetupError('');
    if (!fullName.trim() || !usn.trim()) {
      Alert.alert('Missing Info', 'Please provide your full name and USN.');
      return;
    }

    setSaving(true);
    try {
      const result = await studentService.saveProfile({
        fullName: fullName.trim(),
        rollNumber: usn.trim().toUpperCase(),
        department: department.trim() || 'Computer Science',
        semester: semester ? `${semester} Semester` : '3rd Semester',
        avatarUrl: cloudinaryUrl || photoUri || '',
      });

      setSaving(false);
      if (result.success) {
        if (Platform.OS === 'web') {
          onComplete();
        } else {
          Alert.alert(
            "Profile Complete! 🎉",
            `Welcome to campus, ${result.profile?.firstName}! Your student dashboard is ready.`,
            [{ text: "Open Dashboard", onPress: onComplete }]
          );
        }
      } else {
        setSetupError(result.error || 'Could not complete profile.');
      }
    } catch (err: any) {
      setSaving(false);
      setSetupError(err.message || 'Failed to save profile.');
    }
  };

  const stepConfig = [
    {
      icon: <ImagePlus size={28} color="#9AB9EC" strokeWidth={1.8} />,
      title: 'Add a profile photo',
      subtitle: 'Uploaded securely to Cloudinary and displayed on your student ID',
      skippable: true,
    },
    {
      icon: <User size={28} color="#9AB9EC" strokeWidth={1.8} />,
      title: "What's your full name?",
      subtitle: 'As registered with your university admissions',
      skippable: false,
    },
    {
      icon: <Hash size={28} color="#9AB9EC" strokeWidth={1.8} />,
      title: 'Your USN / Roll Number',
      subtitle: 'Unique institutional identifier (e.g. 1MS22CS001)',
      skippable: false,
    },
    {
      icon: <BookOpen size={28} color="#9AB9EC" strokeWidth={1.8} />,
      title: 'Which department?',
      subtitle: 'Select your academic branch or major',
      skippable: false,
    },
    {
      icon: <Calendar size={28} color="#9AB9EC" strokeWidth={1.8} />,
      title: 'Current semester',
      subtitle: 'Select your ongoing term',
      skippable: false,
    },
  ];

  const currentConfig = stepConfig[step - 1];

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.photoStepContainer}>
            <TouchableOpacity
              style={styles.photoCircle}
              activeOpacity={0.8}
              onPress={handlePickPhoto}
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoImage} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Camera size={36} color="#5A7B9E" strokeWidth={1.6} />
                  <Text style={styles.photoPlaceholderText}>Choose from Gallery</Text>
                </View>
              )}

              <View style={styles.photoCameraBadge}>
                <Camera size={14} color="#FFFFFF" strokeWidth={2.4} />
              </View>

              {uploadingPhoto && (
                <View style={styles.uploadProgressOverlay}>
                  <ActivityIndicator size="small" color="#9AB9EC" />
                  <Text style={styles.uploadProgressText}>{uploadProgress}%</Text>
                </View>
              )}
            </TouchableOpacity>

            {photoUri && (
              <View style={{ alignItems: 'center', marginTop: 16 }}>
                {cloudinaryUrl && (
                  <View style={styles.cloudBadge}>
                    <UploadCloud size={13} color="#4ECCA3" strokeWidth={2.2} style={{ marginRight: 5 }} />
                    <Text style={styles.cloudBadgeText}>Cloudinary Connected</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.changePhotoBtn}
                  onPress={handlePickPhoto}
                  activeOpacity={0.7}
                >
                  <Text style={styles.changePhotoText}>Change Photo</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );

      case 2:
        return (
          <View style={styles.inputStepContainer}>
            <View style={styles.underlineInputGroup}>
              <Text style={styles.inputLabel}>FULL NAME</Text>
              <TextInput
                style={styles.underlineInput}
                value={fullName}
                onChangeText={setFullName}
                placeholder="e.g. Aryan Sharma"
                placeholderTextColor="#3E5E7E"
                autoFocus
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => {
                  if (fullName.trim()) goNext();
                }}
              />
              <View style={[styles.underline, fullName.length > 0 && styles.underlineActive]} />
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.inputStepContainer}>
            <View style={styles.underlineInputGroup}>
              <Text style={styles.inputLabel}>USN / ROLL NUMBER</Text>
              <TextInput
                style={[styles.underlineInput, styles.monoInput]}
                value={usn}
                onChangeText={setUsn}
                placeholder="e.g. CS24123 / 1MS22CS001"
                placeholderTextColor="#3E5E7E"
                autoFocus
                autoCapitalize="characters"
                returnKeyType="next"
                onSubmitEditing={() => {
                  if (usn.trim()) goNext();
                }}
              />
              <View style={[styles.underline, usn.length > 0 && styles.underlineActive]} />
            </View>
          </View>
        );

      case 4:
        return (
          <View style={styles.selectorContainer}>
            {departments.map((dept) => {
              const isSelected = department === dept;
              return (
                <TouchableOpacity
                  key={dept}
                  style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                  onPress={() => setDepartment(dept)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.radioOuter, isSelected && styles.radioOuterActive]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {dept}
                  </Text>
                  {isSelected && (
                    <Check size={16} color="#9AB9EC" strokeWidth={2.5} style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        );

      case 5:
        return (
          <View style={styles.semesterGrid}>
            {semesters.map((sem) => {
              const isSelected = semester === sem;
              return (
                <TouchableOpacity
                  key={sem}
                  style={[styles.semesterTile, isSelected && styles.semesterTileActive]}
                  onPress={() => setSemester(sem)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.semesterNumber, isSelected && styles.semesterNumberActive]}>
                    {sem.replace(/[a-z]/g, '')}
                  </Text>
                  <Text style={[styles.semesterLabel, isSelected && styles.semesterLabelActive]}>
                    {sem.includes('1') ? 'st' : sem.includes('2') ? 'nd' : sem.includes('3') ? 'rd' : 'th'} Sem
                  </Text>
                  {isSelected && (
                    <View style={styles.semesterCheckmark}>
                      <Check size={12} color="#061522" strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <AppBackground variant="dashboard">
      <View style={styles.container}>
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {step} / {TOTAL_STEPS}
          </Text>
        </View>

        {/* Step Header */}
        <Animated.View
          style={[
            styles.stepHeader,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.stepIconContainer}>{currentConfig.icon}</View>
          <Text style={styles.stepTitle}>{currentConfig.title}</Text>
          <Text style={styles.stepSubtitle}>{currentConfig.subtitle}</Text>
        </Animated.View>

        {!!initialEmail && <Text style={{ color: '#8EA5C2', fontSize: 12, marginBottom: 10 }}>Signed in as {initialEmail}</Text>}
        {!!setupError && <Text accessibilityRole="alert" style={{ color: '#F87171', marginBottom: 12 }}>{setupError}</Text>}
        {/* Step Content */}
        <Animated.View
          style={[
            styles.contentArea,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {renderStepContent()}
        </Animated.View>

        {/* Bottom Navigation */}
        <View style={styles.bottomNav}>
          {/* Back Button */}
          {step > 1 ? (
            <TouchableOpacity style={styles.backBtn} onPress={goBack} activeOpacity={0.7}>
              <ArrowLeft size={18} color="#8EA5C2" strokeWidth={2.2} />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.backBtnPlaceholder} />
          )}

          {/* Skip (only for photo) */}
          {currentConfig.skippable && (
            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
              <Text style={styles.skipBtnText}>Skip for now</Text>
              <SkipForward size={14} color="#7F94B0" strokeWidth={2} />
            </TouchableOpacity>
          )}

          {/* Next / Finish Button */}
          <TouchableOpacity
            style={[
              styles.nextBtn,
              !canProceed() && styles.nextBtnDisabled,
              step === TOTAL_STEPS && canProceed() && styles.finishBtn,
            ]}
            onPress={goNext}
            activeOpacity={0.85}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#061522" />
            ) : (
              <>
                <Text
                  style={[
                    styles.nextBtnText,
                    !canProceed() && styles.nextBtnTextDisabled,
                    step === TOTAL_STEPS && canProceed() && styles.finishBtnText,
                  ]}
                >
                  {step === TOTAL_STEPS ? 'Complete Setup' : 'Next'}
                </Text>
                {step === TOTAL_STEPS ? (
                  <Check
                    size={18}
                    color={canProceed() ? '#061522' : '#5A7B9E'}
                    strokeWidth={2.5}
                    style={{ marginLeft: 6 }}
                  />
                ) : (
                  <ArrowRight
                    size={18}
                    color={canProceed() ? '#FFFFFF' : '#5A7B9E'}
                    strokeWidth={2.2}
                    style={{ marginLeft: 6 }}
                  />
                )}
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 16 : 28,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    gap: 12,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#152A40',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#9AB9EC',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7F94B0',
    letterSpacing: 0.5,
    minWidth: 30,
    textAlign: 'right',
  },
  stepHeader: {
    marginBottom: 32,
  },
  stepIconContainer: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: '#0F2338',
    borderWidth: 1.5,
    borderColor: '#1D3B5C',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 33,
    marginBottom: 6,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#7F94B0',
    lineHeight: 20,
  },
  contentArea: {
    flex: 1,
  },
  photoStepContainer: {
    alignItems: 'center',
    paddingTop: 10,
  },
  photoCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#0C1F34',
    borderWidth: 2,
    borderColor: '#1D3B5C',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  photoImage: {
    width: 146,
    height: 146,
    borderRadius: 73,
  },
  photoPlaceholder: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  photoPlaceholderText: {
    fontSize: 12,
    color: '#5A7B9E',
    fontWeight: '600',
    textAlign: 'center',
  },
  photoCameraBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#204772',
    borderWidth: 2.5,
    borderColor: '#0C1F34',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadProgressOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(12, 31, 52, 0.85)',
    borderRadius: 75,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadProgressText: {
    color: '#9AB9EC',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  cloudBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(78, 204, 163, 0.12)',
    borderWidth: 1,
    borderColor: '#4ECCA3',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 10,
  },
  cloudBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4ECCA3',
  },
  changePhotoBtn: {
    paddingVertical: 7,
    paddingHorizontal: 18,
    backgroundColor: '#152A40',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1D3B5C',
  },
  changePhotoText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8EA5C2',
  },
  inputStepContainer: {
    paddingTop: 8,
  },
  underlineInputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#5A7B9E',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  underlineInput: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    paddingVertical: 12,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  monoInput: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 2,
    color: '#B4CBF5',
  },
  underline: {
    height: 2,
    backgroundColor: '#1D3B5C',
    borderRadius: 1,
  },
  underlineActive: {
    backgroundColor: '#6A9CD8',
  },
  selectorContainer: {
    gap: 8,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    backgroundColor: '#0C1F34',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#152A40',
  },
  optionCardSelected: {
    borderColor: '#3A6DA0',
    backgroundColor: '#112C48',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#2A4560',
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterActive: {
    borderColor: '#9AB9EC',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9AB9EC',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8EA5C2',
  },
  optionTextSelected: {
    color: '#FFFFFF',
  },
  semesterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 4,
  },
  semesterTile: {
    width: '22%',
    aspectRatio: 1,
    backgroundColor: '#0C1F34',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#152A40',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  semesterTileActive: {
    borderColor: '#9AB9EC',
    backgroundColor: '#112C48',
    shadowColor: '#9AB9EC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  semesterNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#5A7B9E',
  },
  semesterNumberActive: {
    color: '#FFFFFF',
  },
  semesterLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3E5E7E',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  semesterLabelActive: {
    color: '#9AB9EC',
  },
  semesterCheckmark: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#9AB9EC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    gap: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#0F2338',
    borderWidth: 1,
    borderColor: '#1D3B5C',
    gap: 6,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8EA5C2',
  },
  backBtnPlaceholder: {
    width: 70,
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 4,
  },
  skipBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7F94B0',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 26,
    borderRadius: 20,
    backgroundColor: '#1B4B78',
    gap: 2,
  },
  nextBtnDisabled: {
    backgroundColor: '#112338',
  },
  nextBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  nextBtnTextDisabled: {
    color: '#5A7B9E',
  },
  finishBtn: {
    backgroundColor: '#F3F2EF',
    paddingHorizontal: 28,
  },
  finishBtnText: {
    color: '#061522',
  },
});
