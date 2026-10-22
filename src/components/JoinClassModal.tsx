import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { X, Plus, BookOpen, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { studentService } from '../services/studentService';
import { DatabaseClass } from '../types';

interface JoinClassModalProps {
  visible: boolean;
  studentProfileId: string;
  onClose: () => void;
  onClassJoined: () => void;
}

export const JoinClassModal: React.FC<JoinClassModalProps> = ({
  visible,
  studentProfileId,
  onClose,
  onClassJoined,
}) => {
  const [classCode, setClassCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    type: 'idle' | 'success' | 'error';
    message: string;
    classData?: DatabaseClass;
  }>({ type: 'idle', message: '' });

  const handleJoin = async () => {
    if (!classCode.trim()) {
      setResult({
        type: 'error',
        message: 'Please enter a class code provided by your instructor.',
      });
      return;
    }

    setLoading(true);
    setResult({ type: 'idle', message: '' });

    try {
      const response = await studentService.joinClassByCode(
        studentProfileId,
        classCode.trim()
      );

      setLoading(false);

      if (response.success && response.classData) {
        setResult({
          type: 'success',
          message: `Successfully enrolled in ${response.classData.class_name}!`,
          classData: response.classData,
        });

        // Trigger dashboard refresh
        onClassJoined();

        // Close after a short moment
        setTimeout(() => {
          handleClose();
        }, 1600);
      } else {
        setResult({
          type: 'error',
          message: response.error || 'Unable to join class with this code.',
          classData: response.classData,
        });
      }
    } catch (err: any) {
      setLoading(false);
      setResult({
        type: 'error',
        message: err.message || 'Network error occurred while enrolling in class.',
      });
    }
  };

  const handleClose = () => {
    setClassCode('');
    setResult({ type: 'idle', message: '' });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Plus size={22} color="#9AB9EC" strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.title}>Join a Class</Text>
              <Text style={styles.subtitle}>Ask your teacher for the class code</Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
            >
              <X size={18} color="#8EA5C2" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          {/* Form input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>CLASS CODE</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. CS201-DS"
              placeholderTextColor="#476587"
              value={classCode}
              onChangeText={(text) => {
                setClassCode(text.toUpperCase());
                if (result.type !== 'idle') {
                  setResult({ type: 'idle', message: '' });
                }
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleJoin}
            />
            <Text style={styles.inputHint}>
              Format: 6-10 characters (e.g. CS201-DS, CS203-DB, CS205-OS, CS207-CN)
            </Text>
          </View>

          {/* Result Banner */}
          {result.type !== 'idle' && (
            <View
              style={[
                styles.resultCard,
                result.type === 'success' ? styles.resultSuccess : styles.resultError,
              ]}
            >
              {result.type === 'success' ? (
                <CheckCircle2 size={18} color="#4ECCA3" strokeWidth={2.4} style={{ marginRight: 8 }} />
              ) : (
                <AlertCircle size={18} color="#FC8181" strokeWidth={2.4} style={{ marginRight: 8 }} />
              )}
              <Text style={styles.resultText}>{result.message}</Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleClose}
              activeOpacity={0.7}
              disabled={loading}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.joinBtn, (!classCode.trim() || loading) && styles.joinBtnDisabled]}
              onPress={handleJoin}
              activeOpacity={0.85}
              disabled={!classCode.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#061522" />
              ) : (
                <>
                  <Text style={styles.joinBtnText}>Join Class</Text>
                  <ArrowRight size={16} color="#061522" strokeWidth={2.4} style={{ marginLeft: 6 }} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 10, 18, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0F2338',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#1D3B5C',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#183654',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A527A',
  },
  title: {
    ...Typography.titleLarge,
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    color: '#7F94B0',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#142940',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputSection: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8EA5C2',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  input: {
    height: 52,
    backgroundColor: '#071626',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1E3C60',
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1.5,
  },
  inputHint: {
    fontSize: 11,
    color: '#5C7A9D',
    marginTop: 6,
    lineHeight: 16,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 18,
  },
  resultSuccess: {
    backgroundColor: 'rgba(78, 204, 163, 0.15)',
    borderWidth: 1,
    borderColor: '#4ECCA3',
  },
  resultError: {
    backgroundColor: 'rgba(252, 129, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#FC8181',
  },
  resultText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
    flex: 1,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: '#122538',
    borderWidth: 1,
    borderColor: '#1D3B5C',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8EA5C2',
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 16,
    backgroundColor: Colors.buttonPrimaryBg,
  },
  joinBtnDisabled: {
    backgroundColor: '#1C3857',
    opacity: 0.6,
  },
  joinBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.buttonPrimaryText,
  },
});
