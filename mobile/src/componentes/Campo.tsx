import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { cores, espaco } from '@/lib/tema';

type Props = {
  rotulo: string;
  valor: string;
  onChange: (texto: string) => void;
  tipo?: 'texto' | 'email' | 'senha' | 'numero' | 'telefone';
  erro?: string;
};

const porTipo: Record<NonNullable<Props['tipo']>, TextInputProps> = {
  texto: {},
  email: {
    keyboardType: 'email-address',
    autoCapitalize: 'none',
    autoCorrect: false,
    autoComplete: 'email',
  },
  senha: { secureTextEntry: true, autoCapitalize: 'none', autoCorrect: false },
  numero: { keyboardType: 'numeric' },
  telefone: { keyboardType: 'phone-pad', autoComplete: 'tel' },
};

export function Campo({ rotulo, valor, onChange, tipo = 'texto', erro }: Props) {
  return (
    <View style={estilos.container}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <TextInput
        accessibilityLabel={rotulo}
        value={valor}
        onChangeText={onChange}
        style={[estilos.input, erro ? { borderColor: '#C62828' } : null]}
        placeholderTextColor={cores.textoSecundario}
        {...porTipo[tipo]}
      />
      {erro ? <Text style={estilos.erro}>{erro}</Text> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { gap: espaco.xs },
  rotulo: { fontSize: 14, color: cores.textoSecundario },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 8,
    paddingHorizontal: espaco.md,
    fontSize: 16,
    color: cores.texto,
    backgroundColor: '#FFFFFF',
  },
  erro: { fontSize: 13, color: '#C62828' },
});
