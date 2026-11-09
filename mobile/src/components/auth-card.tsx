import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Logo } from "~/ui/logo";

/** Moldura das telas de entrar/cadastro (logo + cartão), como no site. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView contentContainerClassName="items-center px-4 py-8" keyboardShouldPersistTaps="handled">
          <View className="mb-8">
            <Logo size={40} />
          </View>
          <View className="w-full max-w-md gap-4 rounded-3xl border border-border bg-surface p-6 shadow-lg">{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
