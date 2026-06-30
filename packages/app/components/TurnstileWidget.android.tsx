import { useState, useEffect, useRef } from 'react'
import { View, Text } from 'react-native'
import { WebView } from 'react-native-webview'
import { useColorScheme } from '../hooks/useColorScheme'
import { Progress } from './ui/progress'

interface TurnstileWidgetProps {
  siteKey: string
  onSuccess: (token: string) => void
  onError?: () => void
  onExpire?: () => void
  onReady?: () => void
  // Bump this to force the widget to re-mint a token (Turnstile tokens are
  // single-use, so a fresh one is needed after every verify attempt).
  resetSignal?: number
}

type LoadingState = 'initializing' | 'loading' | 'ready' | 'error'

export function TurnstileWidget({
  siteKey,
  onSuccess,
  onError,
  onExpire,
  onReady,
  resetSignal,
}: TurnstileWidgetProps) {
  const { colorScheme, isDarkColorScheme } = useColorScheme()
  const [key, setKey] = useState(0)
  const [loadingState, setLoadingState] = useState<LoadingState>('initializing')
  const [progress, setProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string>('')

  // Re-mount when theme changes to update Turnstile theme
  useEffect(() => {
    // console.log('🎨 Android Theme changed to:', colorScheme) // DEBUG
    // Always re-mount when theme changes - Turnstile can't change themes dynamically
    setLoadingState('initializing')
    setProgress(0)
    setKey((prev) => prev + 1)
  }, [colorScheme])

  // Re-mount the WebView when the parent bumps resetSignal (after an upload
  // attempt or a captcha error) so the next submit gets a brand-new single-use
  // token instead of replaying a dead one. Skip the first run (initial mount).
  const skipFirstReset = useRef(true)
  useEffect(() => {
    if (skipFirstReset.current) {
      skipFirstReset.current = false
      return
    }
    setLoadingState('initializing')
    setProgress(0)
    setKey((prev) => prev + 1)
  }, [resetSignal])

  // Timeout fallback
  useEffect(() => {
    if (loadingState === 'loading') {
      const timeout = setTimeout(() => {
        // console.error('⏰ Android: Loading timeout') // DEBUG
        setLoadingState('error')
        setErrorMessage(
          'Loading timed out - please check your internet connection'
        )
      }, 10000)

      return () => clearTimeout(timeout)
    }
  }, [loadingState])

  const baseUrl = 'https://alpha.jomcontest.com'

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 85px;
      background: transparent;
    }
    #turnstile-container {
      display: flex;
      justify-content: center;
      align-items: center;
    }
  </style>
</head>
<body>
  <div id="turnstile-container"></div>
</body>
</html>
  `

  const injectedJavaScript = `
    (function() {
      // console.log('INJECTED_START'); // DEBUG
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: 'INJECTED_START' }));
      
      var script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      
      script.onload = function() {
        // console.log('CLOUDFLARE_LOADED'); // DEBUG
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: 'CLOUDFLARE_LOADED' }));
        
        setTimeout(function() {
          if (typeof window.turnstile !== 'undefined') {
            // console.log('TURNSTILE_READY'); // DEBUG
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: 'TURNSTILE_READY' }));
            
            try {
              // console.log('🎨 Rendering Turnstile with theme:', '${colorScheme}'); // DEBUG
              window.turnstile.render('#turnstile-container', {
                sitekey: '${siteKey}',
                theme: '${colorScheme}',
                size: 'normal',
                callback: function(token) {
                  // console.log('TURNSTILE_SUCCESS'); // DEBUG
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'success',
                    token: token
                  }));
                },
                'error-callback': function() {
                  // console.log('TURNSTILE_ERROR'); // DEBUG
                  window.ReactNativeWebView.postMessage(JSON.stringify({ 
                    type: 'error',
                    message: 'Turnstile validation failed'
                  }));
                },
                'expired-callback': function() {
                  // console.log('TURNSTILE_EXPIRED'); // DEBUG
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'expired' }));
                },
              });
              // console.log('TURNSTILE_RENDERED'); // DEBUG
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: 'TURNSTILE_RENDERED' }));
            } catch (e) {
              // console.error('RENDER_ERROR: ' + e.message); // DEBUG
              window.ReactNativeWebView.postMessage(JSON.stringify({ 
                type: 'error',
                message: 'Failed to render: ' + e.message
              }));
            }
          } else {
            // console.error('TURNSTILE_NOT_AVAILABLE'); // DEBUG
            window.ReactNativeWebView.postMessage(JSON.stringify({ 
              type: 'error',
              message: 'Turnstile API not available'
            }));
          }
        }, 100);
      };
      
      script.onerror = function(e) {
        // console.error('SCRIPT_LOAD_FAILED'); // DEBUG
        window.ReactNativeWebView.postMessage(JSON.stringify({ 
          type: 'error',
          message: 'Failed to load Cloudflare Turnstile'
        }));
      };
      
      document.head.appendChild(script);
      // console.log('SCRIPT_ADDED'); // DEBUG
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: 'SCRIPT_ADDED' }));
      
      // Enhanced touch event handling for Android (especially older devices like Samsung Note 9)
      // Apply styles to ensure iframe and all child elements are touchable
      function enableTouchOnIframes() {
        var iframes = document.querySelectorAll('iframe');
        iframes.forEach(function(iframe) {
          // Enable all pointer events on iframe
          iframe.style.pointerEvents = 'auto';
          iframe.style.touchAction = 'auto';
          iframe.style.userSelect = 'auto';
          iframe.style.webkitUserSelect = 'auto';
          iframe.style.zIndex = '999999';
          iframe.style.visibility = 'visible';
          iframe.style.opacity = '1';
          
          // Apply to parent elements
          var parent = iframe.parentElement;
          while (parent && parent !== document.body) {
            parent.style.pointerEvents = 'auto';
            parent.style.touchAction = 'auto';
            parent = parent.parentElement;
          }
        });
        
        // Also ensure container is touchable
        var container = document.getElementById('turnstile-container');
        if (container) {
          container.style.pointerEvents = 'auto';
          container.style.touchAction = 'auto';
        }
      }
      
      // Apply immediately
      enableTouchOnIframes();
      
      // Re-apply multiple times to catch Turnstile's iframe
      var intervals = [100, 200, 300, 500, 800, 1000, 1500, 2000, 3000];
      intervals.forEach(function(delay) {
        setTimeout(enableTouchOnIframes, delay);
      });
      
      // Continuous monitoring with MutationObserver
      var observer = new MutationObserver(function(mutations) {
        var shouldReapply = false;
        mutations.forEach(function(mutation) {
          mutation.addedNodes.forEach(function(node) {
            if (node.tagName === 'IFRAME' || (node.querySelector && node.querySelector('iframe'))) {
              shouldReapply = true;
            }
          });
        });
        if (shouldReapply) {
          enableTouchOnIframes();
          // Re-apply again after a short delay in case iframe content is still loading
          setTimeout(enableTouchOnIframes, 100);
          setTimeout(enableTouchOnIframes, 300);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      
    })();
    
    true;
  `

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data)
      // console.log('📨 Android message:', data.type, data.message || '') // DEBUG

      switch (data.type) {
        case 'log':
          if (data.message === 'INJECTED_START') {
            setProgress(30)
          } else if (data.message === 'SCRIPT_ADDED') {
            setProgress(50)
          } else if (data.message === 'CLOUDFLARE_LOADED') {
            setProgress(70)
          } else if (data.message === 'TURNSTILE_READY') {
            setProgress(85)
          } else if (data.message === 'TURNSTILE_RENDERED') {
            setProgress(100)
            setTimeout(() => {
              setLoadingState('ready')
              onReady?.()
            }, 500)
          }
          break
        case 'success':
          setLoadingState('ready')
          setProgress(100)
          onReady?.() // Ensure ready state is set when verification succeeds
          onSuccess(data.token)
          break
        case 'error':
          setLoadingState('error')
          setErrorMessage(data.message || 'Failed to load CAPTCHA')
          onError?.()
          break
        case 'expired':
          // Reset state to allow re-verification
          setLoadingState('initializing')
          setProgress(0)
          setKey((prev) => prev + 1)
          onExpire?.()
          break
      }
    } catch (err) {
      // console.error('❌ Android parse error:', err) // DEBUG
      setLoadingState('error')
      setErrorMessage('Failed to parse message')
      onError?.()
    }
  }

  return (
    <View
      style={{
        width: '100%',
        minHeight: 85,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 8,
      }}
    >
      {/* Loading Overlay */}
      {(loadingState === 'initializing' || loadingState === 'loading') && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDarkColorScheme
              ? 'rgba(0,0,0,0.5)'
              : 'rgba(255,255,255,0.9)',
            borderRadius: 8,
            padding: 16,
            zIndex: 10,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              color: isDarkColorScheme ? '#fff' : '#000',
              opacity: 0.8,
              marginBottom: 12,
            }}
          >
            Loading security check...
          </Text>
          <View style={{ width: 200 }}>
            <Progress value={progress} />
          </View>
          <Text
            style={{
              fontSize: 11,
              color: isDarkColorScheme ? '#fff' : '#000',
              opacity: 0.5,
              marginTop: 8,
            }}
          >
            {progress}%
          </Text>
        </View>
      )}

      {/* Error State */}
      {loadingState === 'error' && (
        <View
          style={{
            width: '100%',
            minHeight: 85,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDarkColorScheme
              ? 'rgba(220,38,38,0.1)'
              : 'rgba(220,38,38,0.05)',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: isDarkColorScheme
              ? 'rgba(220,38,38,0.3)'
              : 'rgba(220,38,38,0.2)',
            padding: 16,
          }}
        >
          <Text style={{ fontSize: 24, marginBottom: 8 }}>⚠️</Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: isDarkColorScheme ? '#fca5a5' : '#dc2626',
              marginBottom: 4,
            }}
          >
            CAPTCHA Unavailable
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: isDarkColorScheme ? '#fca5a5' : '#dc2626',
              opacity: 0.8,
              textAlign: 'center',
            }}
          >
            {errorMessage}
          </Text>
        </View>
      )}

      {/* WebView (hidden during loading/error) */}
      <View
        style={{
          width: 320,
          height: 85,
          opacity: loadingState === 'ready' ? 1 : 0,
        }}
      >
        <WebView
          key={key}
          source={{ html, baseUrl }}
          onMessage={handleMessage}
          injectedJavaScript={injectedJavaScript}
          injectedJavaScriptForMainFrameOnly={false}
          style={{
            width: 320,
            height: 85,
            backgroundColor: 'transparent',
          }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={false}
          scrollEnabled={false}
          bounces={false}
          originWhitelist={['*']}
          mixedContentMode="always"
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          androidHardwareAccelerationDisabled={false}
          androidLayerType="hardware"
          cacheEnabled={false}
          incognito={true}
          onLoadStart={() => {
            // console.log('🔄 Android: Load start') // DEBUG
            setLoadingState('loading')
            setProgress(10)
          }}
          onLoadEnd={() => {
            // console.log('✅ Android: Load end') // DEBUG
            setProgress(20)
          }}
          onError={(syntheticEvent) => {
            // console.error('❌ Android error:', syntheticEvent.nativeEvent.description) // DEBUG
            setLoadingState('error')
            setErrorMessage(syntheticEvent.nativeEvent.description)
          }}
          onHttpError={(syntheticEvent) => {
            // console.error('❌ Android HTTP:', syntheticEvent.nativeEvent.statusCode) // DEBUG
            setLoadingState('error')
            setErrorMessage(
              `HTTP Error: ${syntheticEvent.nativeEvent.statusCode}`
            )
          }}
        />
      </View>
    </View>
  )
}
