import React, { Component, ErrorInfo, ReactNode } from 'react'; 
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'; 
 
interface Props { 
  children: ReactNode; 
  fallback?: ReactNode; 
}
 
interface State { 
  hasError: boolean; 
  error: Error | null; 
}
export class ErrorBoundary extends Component<Props, State> { 
  constructor(props: Props) {  
    super(props);  
    this.state = { hasError: false, error: null };  
  } 
  
  static getDerivedStateFromError(error: Error): State {  
    return { hasError: true, error };  
  } 
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {  
    console.error('[ErrorBoundary]', error, errorInfo);  
  } 
  
  handleRetry = () => {  
    this.setState({ hasError: false, error: null });  
  }; 
  render() {  
    if (this.state.hasError) {  
      if (this.props.fallback) return this.props.fallback;  
      return ( 
        <View style={styles.container}> 
          <Text style={styles.icon}>??</Text> 
          <Text style={styles.title}>页面出错了</Text>  
          <Text style={styles.message}>{this.state.error?.message || '未知错误'}</Text> 
          <TouchableOpacity style={styles.button} onPress={this.handleRetry}>  
            <Text style={styles.buttonText}>重试</Text>  
          </TouchableOpacity>  
        </View> 
      );  
    }  
    return this.props.children;  
  }  
} 
  
const styles = StyleSheet.create({  
  container: {  
    flex: 1,  
    backgroundColor: '#0d1117',  
    justifyContent: 'center',  
    alignItems: 'center',  
    padding: 24,  
  }, 
  icon: { fontSize: 48, marginBottom: 16 },  
  title: { color: '#c9d1d9', fontSize: 20, fontWeight: '600', marginBottom: 8 },  
  message: { color: '#8b949e', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },  
  button: {  
    backgroundColor: '#1f6feb',  
    paddingHorizontal: 24,  
    paddingVertical: 12,  
    borderRadius: 8,  
  },  
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '500' },  
}); 
