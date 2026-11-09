import { View } from "react-native";
import { Screen, Text } from "~/ui";
import { Logo } from "~/ui/logo";

const H = ({ children }: { children: string }) => <Text className="mt-6 font-display text-xl font-bold">{children}</Text>;
const P = ({ children }: { children: React.ReactNode }) => <Text className="leading-relaxed">{children}</Text>;
const Li = ({ children }: { children: React.ReactNode }) => <Text className="pl-2 leading-relaxed">• {children}</Text>;
const B = ({ children }: { children: string }) => <Text className="font-bold">{children}</Text>;

/** Termo de Uso e Política de Privacidade (mesmo texto do site). */
export default function Termos() {
  return (
    <Screen>
      <Logo size={32} />
      <View className="mt-8 gap-3">
        <Text className="font-display text-3xl font-extrabold">Termo de Uso e Política de Privacidade</Text>
        <Text className="text-sm text-muted">Versão 1.0 — vigente a partir de outubro de 2026.</Text>
        <H>1. O que é o BoraTreinar</H>
        <P>O BoraTreinar é uma ferramenta para Personais/Instrutores montarem treinos e acompanharem a evolução dos seus alunos, e para alunos registrarem seus treinos.</P>
        <H>2. Dados que coletamos</H>
        <Li>Cadastro: nome, e-mail, telefone (WhatsApp) e, opcionalmente, data de nascimento.</Li>
        <Li>Treinos: fichas, exercícios, cargas, repetições, séries realizadas e datas.</Li>
        <Li>Peso corporal, quando você registrar.</Li>
        <P>
          Peso corporal e informações de treino podem ser considerados <B>dados pessoais sensíveis</B> (saúde). Eles são tratados com base no seu <B>consentimento</B> (art. 11, I, da LGPD), que você dá ao aceitar este termo.
        </P>
        <H>3. Quem vê seus dados</H>
        <Li>Aluno: você e os Personais vinculados a você (o responsável e, se houver, o compartilhado).</Li>
        <Li>Peso corporal: só fica visível ao Personal se você permitir, e você pode mudar isso a qualquer momento.</Li>
        <Li>Nenhum aluno vê dados de outros alunos.</Li>
        <Li>Não vendemos nem compartilhamos seus dados com terceiros para publicidade.</Li>
        <H>4. Operadores</H>
        <P>
          Usamos provedores para hospedar o app e o banco de dados (Vercel e Supabase), enviar e-mails (Resend) e, opcionalmente, gerar sugestões de treino no relatório semanal por inteligência artificial. Nesse caso, enviamos apenas dados agregados de treino, sem nome, e-mail ou telefone.
        </P>
        <H>5. Seus direitos</H>
        <P>
          Você pode, a qualquer momento, acessar e corrigir seus dados, exportá-los, revogar o consentimento e pedir a exclusão da sua conta, na página <B>Privacidade e meus dados</B> (aba Personais). A exclusão apaga definitivamente seus dados de treino e de peso.
        </P>
        <H>6. Segurança</H>
        <P>O acesso aos dados é controlado no banco por regras de segurança por linha (RLS). Ainda assim, proteja sua senha e não a compartilhe.</P>
        <H>7. Contato</H>
        <P>Dúvidas sobre privacidade: fale com o seu Personal ou com o responsável pelo app.</P>
      </View>
    </Screen>
  );
}
