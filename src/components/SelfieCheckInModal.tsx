import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Modal, Platform, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import {SelfieSubmissionCard} from './SelfieSubmissionCard';
import { Colors } from '../theme/colors';
import Svg, { Path } from 'react-native-svg';
import { ArrowUp, Camera, RotateCcw, Sun, SunMoon, SwitchCamera, UserRound, X } from 'lucide-react-native';

interface SelfieCheckInModalProps {
  onClose: () => void;
  previewMode?: boolean;
  courseCode?: string;
  profileAvatarUri?: string;
  onSubmit?: (photoUri: string) => Promise<void>;
  onComplete?: () => void;
}

// Measured from the reference: continuous squircle, exponent 3.676.
const SELFIE_FRAME_PATH = 'M100.000 0.000 C113.090 0.000 126.386 -0.341 140.991 1.040 C155.595 2.422 171.975 6.348 182.815 17.195 C193.656 28.043 197.579 44.432 198.960 59.045 C200.341 73.659 200.000 86.963 200.000 100.061 C200.000 113.159 200.341 126.464 198.960 141.077 C197.579 155.690 193.656 172.080 182.815 182.927 C171.975 193.774 155.595 197.700 140.991 199.082 C126.386 200.464 113.090 200.122 100.000 200.122 C86.910 200.122 73.614 200.464 59.009 199.082 C44.405 197.700 28.025 193.774 17.185 182.927 C6.344 172.080 2.421 155.690 1.040 141.077 C-0.341 126.464 0.000 113.159 0.000 100.061 C0.000 86.963 -0.341 73.659 1.040 59.045 C2.421 44.432 6.344 28.043 17.185 17.195 C28.025 6.348 44.405 2.422 59.009 1.040 C73.614 -0.341 86.910 0.000 100.000 0.000 Z';

/** The design preview never uploads a photo or creates an attendance record. */
export function SelfieCheckInModal({ onClose, previewMode = false, courseCode, profileAvatarUri, onSubmit, onComplete }: SelfieCheckInModalProps) {
  const { width, height } = useWindowDimensions();
  const frameWidth = Math.min(430, width - (Platform.OS === 'web' ? 24 : 0), (height - (Platform.OS === 'web' ? 24 : 0)) * 9 / 16);
  const scale = frameWidth / 390;
  const camera = useRef<CameraView>(null);
  const busyRef = useRef(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  const [facing, setFacing] = useState<CameraType>('front');
  const [fillLight, setFillLight] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [sampleCaptured, setSampleCaptured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isReview = !!photoUri || sampleCaptured;
  const sample = previewMode && !cameraEnabled;
  const sampleSource = require('../../assets/aryan.jpg');
  const profileSource = profileAvatarUri ? { uri: profileAvatarUri } : previewMode ? sampleSource : null;
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { setForeground(state === 'active'); setReady(false); });
    return () => listener.remove();
  }, []);
  const close = () => { if (busyRef.current) return; if (sent && !previewMode) onComplete?.(); onClose(); };
  const enableCamera = async () => {
    setError(null);
    try {
      const result = permission?.granted ? permission : await requestPermission();
      if (!result.granted) { setError('Allow camera access in your browser or phone settings to take a selfie.'); return; }
      setReady(false); setCameraEnabled(true); setSampleCaptured(false);
    } catch { setError('Could not open the camera. Check camera access and try again.'); }
  };
  const capture = async () => {
    if (busyRef.current) return;
    setError(null);
    if (sample) { setSampleCaptured(true); return; }
    if (!cameraEnabled || !ready || !camera.current) return;
    busyRef.current = true; setBusy(true);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.85 });
      if (!photo?.uri) throw new Error('The camera did not return a photo. Please try again.');
      setPhotoUri(photo.uri); setReady(false);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not take a photo. Please try again.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const retake = () => { setPhotoUri(null); setSampleCaptured(false); setError(null); setReady(false); };
  const send = async () => {
    if (busyRef.current || !isReview) return;
    setError(null);
    if (previewMode) { setSent(true); return; }
    if (!photoUri || !onSubmit) { setError('Take a fresh selfie before sending your check-in.'); return; }
    busyRef.current = true; setBusy(true);
    try { await onSubmit(photoUri); setSent(true); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not send your selfie. Your attendance has not been submitted.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  return <Modal visible transparent animationType="fade" onRequestClose={close} statusBarTranslucent={false}>
    <View style={s.backdrop}><View testID="selfie-portrait-frame" style={[s.frame, { width: frameWidth, height: frameWidth * 16 / 9 }, fillLight && !isReview && s.litFrame]}>
      <View style={[s.topbar, { paddingHorizontal: 18 * scale, paddingTop: 15 * scale }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close selfie camera" onPress={close} disabled={busy} style={s.iconButton}><X size={23 * scale} color="#fff" strokeWidth={1.7} /></TouchableOpacity>
        <View style={s.headerText}><Text style={[s.title, { fontSize: 13 * scale }]}>{sent ? (previewMode ? 'Preview complete' : 'Sent for review') : isReview ? 'Your moment, captured' : 'Your check-in'}</Text><Text style={[s.headerSubtitle, { fontSize: 10 * scale }]}>{courseCode || 'Just you. Right now.'}</Text></View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="View profile photo" onPress={() => { setProfileOpen(!profileOpen); }} disabled={busy} style={s.profileButton}>
          {profileSource ? <Image source={profileSource} style={s.profileThumb} /> : <UserRound size={18 * scale} color="#b9bcc5" />}
        </TouchableOpacity>
      </View>
      {previewMode && <View style={s.previewBadge}><View style={s.previewDot} /><Text style={s.previewBadgeText}>DESIGN PREVIEW</Text></View>}
      <View style={s.cameraArea}>
        {sent ? <SelfieSubmissionCard photoUri={photoUri} courseCode={courseCode} preview={previewMode} onDone={close}/> : <>
          <View testID="selfie-camera-contour" style={[s.cameraWindow, { width: frameWidth * .83, height: frameWidth * .83 * 1.000611 }]}>
            {sample ? <Image source={sampleSource} style={[StyleSheet.absoluteFill, s.fullImage, s.sampleImage]} resizeMode="cover" /> : photoUri ? <Image source={{ uri: photoUri }} style={[StyleSheet.absoluteFill, s.fullImage]} resizeMode="cover" /> : cameraEnabled && permission?.granted && foreground ? <CameraView key={facing} ref={camera} style={StyleSheet.absoluteFill} facing={facing} mirror={facing === 'front'} mute mode="picture" onCameraReady={() => setReady(true)} onMountError={() => { setReady(false); setError('Your camera could not start. Check that another app is not using it.'); }} /> : <View style={s.cameraPlaceholder}><View style={s.faceOutline}><UserRound size={88 * scale} color={Colors.textMuted} strokeWidth={.7} /></View><TouchableOpacity accessibilityRole="button" onPress={enableCamera} style={s.enableButton}><Camera size={15} color="#17191b" /><Text style={s.enableText}>Enable camera</Text></TouchableOpacity></View>}
            {sample && <View style={s.sampleLabel}><Text style={s.sampleLabelText}>SAMPLE PHOTO · NOT UPLOADED</Text></View>}
            {profileOpen && <View style={s.profilePeek}><Text style={s.peekTitle}>Your profile photo</Text>{profileSource ? <Image source={profileSource} style={s.peekPhoto} /> : <UserRound size={42} color="#a9adb6" />}<Text style={s.peekCaption}>Your faculty compares this with your selfie.</Text></View>}
            {busy && <View style={s.captureBusy}><ActivityIndicator color="#fff" /></View>}
            <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 200 200.122" preserveAspectRatio="none" aria-hidden>
              <Path d={`M-2 -2 H202 V202.122 H-2 Z ${SELFIE_FRAME_PATH}`} fill={Colors.background} fillRule="evenodd" />
            </Svg>
          </View>
          <Text style={[s.cameraCaption, { fontSize: 11 * scale }]}>{isReview ? 'Clear face. Good light. All you.' : 'A quick selfie. Then you’re in.'}</Text>
          {previewMode && !cameraEnabled && !isReview && <TouchableOpacity accessibilityRole="button" onPress={enableCamera} style={s.tryCamera}><Camera size={12} color="#9b9da3" /><Text style={s.tryCameraText}>Try my camera instead</Text></TouchableOpacity>}
        </>}
      </View>
      {!sent && <View style={[s.bottomArea, { paddingBottom: 27 * scale }]}>
        {error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
        <View style={[s.controls, { gap: 37 * scale, marginBottom: 28 * scale }]}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={isReview ? 'Retake selfie' : fillLight ? 'Turn off fill light' : 'Turn on fill light'} accessibilityState={{ selected: !isReview && fillLight, disabled: busy }} disabled={busy} onPress={isReview ? retake : () => setFillLight(!fillLight)} style={[s.sideControl, fillLight && !isReview && s.sideControlActive]}>
            {isReview ? <RotateCcw size={19 * scale} color="#ddd" strokeWidth={1.7} /> : fillLight ? <Sun size={19 * scale} color="#17191b" strokeWidth={1.7} /> : <SunMoon size={19 * scale} color="#babdc4" strokeWidth={1.7} />}
          </TouchableOpacity>
          <View style={s.shutterColumn}><TouchableOpacity accessibilityRole="button" accessibilityLabel={isReview ? (previewMode ? 'Preview sending selfie' : 'Send selfie to faculty') : sample ? 'Preview taking selfie' : 'Take selfie'} disabled={busy || (!sample && !isReview && (!ready || !cameraEnabled))} onPress={isReview ? send : capture} style={[s.shutterOuter, { width: 74 * scale, height: 74 * scale, borderRadius: 37 * scale }, !sample && !isReview && !ready && s.disabledShutter]}>
            <View style={[s.shutterInner, { width: 58 * scale, height: 58 * scale, borderRadius: 29 * scale }]}>{busy ? <ActivityIndicator color="#111" /> : isReview ? <ArrowUp size={25 * scale} color="#111" strokeWidth={2} /> : null}</View>
          </TouchableOpacity>{isReview && <Text style={s.sendLabel}>{previewMode ? 'Preview send' : 'Send selfie'}</Text>}</View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={isReview ? 'Compare with profile photo' : 'Flip camera'} disabled={busy || (isReview ? false : !cameraEnabled)} onPress={isReview ? () => setProfileOpen(!profileOpen) : () => { setReady(false); setFacing(facing === 'front' ? 'back' : 'front'); }} style={[s.sideControl, !isReview && !cameraEnabled && s.dimmed]}>
            {isReview ? <UserRound size={19 * scale} color="#babdc4" strokeWidth={1.7} /> : <SwitchCamera size={20 * scale} color="#babdc4" strokeWidth={1.7} />}
          </TouchableOpacity>
        </View>
        <Text style={s.footerHint}>{previewMode ? 'Preview only · nothing is sent' : 'Compared with your profile by your faculty.'}</Text>
      </View>}
    </View></View>
  </Modal>;
}
const s = StyleSheet.create({
  backdrop:{ flex:1, backgroundColor:Colors.backgroundDark, alignItems:'center', justifyContent:'center' },
  frame:{ backgroundColor:Colors.background, overflow:'hidden', borderRadius:Platform.OS === 'web' ? 30 : 0, borderWidth:Platform.OS === 'web' ? 1 : 0, borderColor:Colors.borderSubtle },
  litFrame:{ borderColor:'#fff1d0', borderWidth:9 },
  topbar:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', minHeight:64 },
  iconButton:{ width:38, height:38, alignItems:'center', justifyContent:'center' },
  headerText:{ alignItems:'center', flex:1 }, title:{ color:'#f6f6f7', fontWeight:'600', letterSpacing:.1 }, headerSubtitle:{ color:Colors.textSecondary, marginTop:5 },
  profileButton:{ width:38, height:38, justifyContent:'center', alignItems:'center' }, profileThumb:{ width:23, height:23, borderRadius:8, borderWidth:1, borderColor:'#3a3d43' },
  previewBadge:{ alignSelf:'center', flexDirection:'row', alignItems:'center', gap:5, marginTop:5 }, previewDot:{ width:4, height:4, borderRadius:2, backgroundColor:'#8f928b' }, previewBadgeText:{ color:'#696b73', fontSize:7, fontWeight:'600', letterSpacing:1.5 },
  cameraArea:{ flex:1, justifyContent:'center', alignItems:'center', paddingTop:12 }, cameraWindow:{ overflow:'hidden', backgroundColor:Colors.cardInput }, fullImage:{ width:'100%', height:'100%' }, sampleImage:{ transform:[{scale:1.35}] },
  cameraPlaceholder:{ flex:1, alignItems:'center', justifyContent:'center', gap:25, backgroundColor:Colors.cardInput }, faceOutline:{ width:145, height:170, borderWidth:1, borderColor:Colors.borderInputFocused, borderRadius:65, justifyContent:'center', alignItems:'center' },
  enableButton:{ flexDirection:'row', gap:7, backgroundColor:'#ececef', paddingHorizontal:14, paddingVertical:9, borderRadius:20 }, enableText:{ color:'#17191b', fontSize:11, fontWeight:'600' },
  sampleLabel:{ position:'absolute', bottom:13, alignSelf:'center', backgroundColor:'#0009', paddingVertical:5, paddingHorizontal:9, borderRadius:20 }, sampleLabelText:{ color:'#e0e0e2', fontSize:7, letterSpacing:1.05 },
  cameraCaption:{ color:Colors.textSecondary, marginTop:18, letterSpacing:.1 }, tryCamera:{ flexDirection:'row', gap:5, padding:9, alignItems:'center', marginTop:2 }, tryCameraText:{ color:Colors.textSecondary, fontSize:9 },
  bottomArea:{ alignItems:'center', paddingHorizontal:22 }, controls:{ flexDirection:'row', justifyContent:'center', alignItems:'center', marginTop:10 },
  sideControl:{ width:39, height:39, borderRadius:20, justifyContent:'center', alignItems:'center', backgroundColor:Colors.cardElevated }, sideControlActive:{ backgroundColor:'#fff1d0' },
  shutterColumn:{ alignItems:'center', position:'relative' }, shutterOuter:{ borderWidth:4, borderColor:Colors.borderInputFocused, justifyContent:'center', alignItems:'center', backgroundColor:Colors.backgroundSecondary }, shutterInner:{ backgroundColor:Colors.textBrightBlue, justifyContent:'center', alignItems:'center' },
  disabledShutter:{ opacity:.35 }, dimmed:{ opacity:.4 }, sendLabel:{ position:'absolute', bottom:-18, color:'#b0b2ba', fontSize:9, width:100, textAlign:'center' },
  footerHint:{ color:Colors.textMuted, fontSize:10, marginTop:12, textAlign:'center', lineHeight:12 },
  profilePeek:{ ...StyleSheet.absoluteFill, backgroundColor:Colors.backgroundSecondary, alignItems:'center', justifyContent:'center', padding:25 }, peekTitle:{ color:'#fff', fontSize:13, fontWeight:'600', marginBottom:18 }, peekPhoto:{ width:102, height:102, borderRadius:38 }, peekCaption:{ color:'#979ba6', fontSize:11, textAlign:'center', lineHeight:17, marginTop:18 },
  captureBusy:{ ...StyleSheet.absoluteFill, justifyContent:'center', alignItems:'center', backgroundColor:'#0006' }, error:{ color:'#ffadaf', fontSize:10, lineHeight:15, textAlign:'center', paddingBottom:12 },
  sentContent:{ alignItems:'center', paddingHorizontal:30, paddingBottom:55 }, sentIcon:{ width:65, height:65, borderRadius:26, backgroundColor:'#1c2a1c', borderWidth:1, borderColor:'#3a4c32', alignItems:'center', justifyContent:'center', marginBottom:24 }, sentTitle:{ color:'#f5f5f7', fontWeight:'600', letterSpacing:-.4 }, sentDescription:{ color:'#8e929d', textAlign:'center', lineHeight:20, marginTop:12 }, doneButton:{ paddingVertical:11, paddingHorizontal:30, borderRadius:24, backgroundColor:'#f0f1f3', marginTop:25 }, doneText:{ color:'#14171a', fontWeight:'600', fontSize:12 },
});
