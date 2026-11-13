import React, { useState, useContext, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import API from "../services/api";
import { AppContext } from "../context/AppContext";
import { COLORS, GRADIENTS } from "../utils/colors";
import { SPACING, RADIUS, SHADOWS, TYPE } from "../utils/theme";

export default function LoginScreen() {
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("mobile");
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);

  const { login } = useContext(AppContext);

  const handleRequestOTP = async () => {
    if (!mobile || mobile.length < 10) {
      Alert.alert("Invalid Mobile", "Please enter a valid 10-digit mobile number");
      return;
    }
    setLoading(true);
    try {
      Alert.alert("OTP Sent", "Demo OTP: 1234");
      setStep("otp");
      setTimer(120);
    } catch (err) {
      Alert.alert("Error", err.response?.data?.msg || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 4) {
      Alert.alert("Invalid OTP", "Please enter a valid 4-digit OTP");
      return;
    }
    setLoading(true);
    try {
      const res = await API.post("/auth/verify-otp", { mobile, otp });
      login(res.data.user, res.data.token);
    } catch (err) {
      Alert.alert("Login Failed", err.response?.data?.msg || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (timer > 0) {
      const i = setInterval(() => setTimer((t) => t - 1), 1000);
      return () => clearInterval(i);
    }
  }, [timer]);

  return (
    <LinearGradient colors={GRADIENTS.primary} style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Hero */}
          <View style={styles.hero}>
            <Text style={styles.logo}>🌱</Text>
            <Text style={styles.brand}>GrowFresh</Text>
            <Text style={styles.tagline}>Grow your own. Live well.</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {step === "mobile" ? (
              <>
                <Text style={styles.title}>Welcome</Text>
                <Text style={styles.desc}>Enter your mobile to get an OTP</Text>

                <View style={styles.inputWrap}>
                  <Text style={styles.prefix}>+91</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="98765 43210"
                    placeholderTextColor={COLORS.muted}
                    keyboardType="phone-pad"
                    value={mobile}
                    onChangeText={setMobile}
                    editable={!loading}
                    maxLength={10}
                  />
                </View>

                <PrimaryButton
                  label="Request OTP"
                  loading={loading}
                  onPress={handleRequestOTP}
                />
              </>
            ) : (
              <>
                <Text style={styles.title}>Verify OTP</Text>
                <Text style={styles.desc}>Sent to +91 {mobile}</Text>

                <TextInput
                  style={[styles.input, styles.otpInput]}
                  placeholder="0000"
                  placeholderTextColor={COLORS.muted}
                  keyboardType="number-pad"
                  value={otp}
                  onChangeText={setOtp}
                  maxLength={4}
                  editable={!loading}
                />

                {timer > 0 ? (
                  <Text style={styles.timer}>OTP expires in {timer}s</Text>
                ) : (
                  <TouchableOpacity onPress={handleRequestOTP}>
                    <Text style={styles.linkBold}>Resend OTP</Text>
                  </TouchableOpacity>
                )}

                <PrimaryButton
                  label="Verify & Login"
                  loading={loading}
                  onPress={handleVerifyOTP}
                />

                <TouchableOpacity onPress={() => setStep("mobile")} style={{ marginTop: SPACING.sm }}>
                  <Text style={styles.link}>Change mobile number</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <Text style={styles.demoText}>Demo Mobile: Any 10 digits · OTP: 1234</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function PrimaryButton({ label, loading, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={loading}
      style={{ marginTop: SPACING.md }}
    >
      <LinearGradient
        colors={loading ? [COLORS.muted, COLORS.muted] : GRADIENTS.fresh}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.btn}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <Text style={styles.btnText}>{label}</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xxl,
  },
  hero: {
    alignItems: "center",
    marginBottom: SPACING.xl,
  },
  logo: { fontSize: 56, marginBottom: 4 },
  brand: {
    fontSize: 34,
    fontWeight: "900",
    color: COLORS.white,
    letterSpacing: 0.5,
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  tagline: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    marginTop: 4,
    fontWeight: "600",
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.xl,
    ...SHADOWS.md,
  },
  title: {
    ...TYPE.title,
    color: COLORS.text,
    marginBottom: 4,
  },
  desc: {
    ...TYPE.caption,
    color: COLORS.muted,
    marginBottom: SPACING.lg,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.greenPale,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.bg,
  },
  prefix: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.green,
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  otpInput: {
    borderWidth: 1.5,
    borderColor: COLORS.greenPale,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.bg,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 8,
  },
  btn: {
    borderRadius: RADIUS.sm,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: {
    color: COLORS.white,
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.3,
  },
  timer: {
    textAlign: "center",
    color: COLORS.orangeDeep,
    fontSize: 12,
    marginTop: SPACING.sm,
    fontWeight: "700",
  },
  link: {
    textAlign: "center",
    color: COLORS.green,
    fontSize: 13,
    fontWeight: "700",
  },
  linkBold: {
    textAlign: "center",
    color: COLORS.green,
    fontSize: 13,
    fontWeight: "800",
    marginTop: SPACING.sm,
  },
  demoText: {
    textAlign: "center",
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    marginTop: SPACING.lg,
    fontStyle: "italic",
  },
});
