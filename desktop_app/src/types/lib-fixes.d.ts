// 修复第三方库与 React 18 类型不兼容的问题

declare module 'react-error-boundary' {
    import * as React from 'react';

    export interface FallbackProps {
        error: Error;
        resetErrorBoundary: (...args: Array<unknown>) => void;
    }

    export interface ErrorBoundaryPropsWithComponent {
        children?: React.ReactNode;
        FallbackComponent: React.ComponentType<FallbackProps>;
        fallback?: never;
        onError?: (error: Error, info: { componentStack: string }) => void;
        onReset?: (...args: Array<unknown>) => void;
        resetKeys?: Array<unknown>;
    }

    export interface ErrorBoundaryPropsWithRender {
        children?: React.ReactNode;
        fallbackRender: (props: FallbackProps) => React.ReactNode;
        FallbackComponent?: never;
        fallback?: never;
        onError?: (error: Error, info: { componentStack: string }) => void;
        onReset?: (...args: Array<unknown>) => void;
        resetKeys?: Array<unknown>;
    }

    export interface ErrorBoundaryPropsWithFallback {
        children?: React.ReactNode;
        fallback: React.ReactNode;
        FallbackComponent?: never;
        fallbackRender?: never;
        onError?: (error: Error, info: { componentStack: string }) => void;
        onReset?: (...args: Array<unknown>) => void;
        resetKeys?: Array<unknown>;
    }

    export type ErrorBoundaryProps =
        | ErrorBoundaryPropsWithComponent
        | ErrorBoundaryPropsWithRender
        | ErrorBoundaryPropsWithFallback;

    export const ErrorBoundary: React.ComponentType<ErrorBoundaryProps>;
}

declare module 'react-hot-toast' {
    import * as React from 'react';

    export interface Toast {
        id: string;
        message: string;
        icon?: React.ReactNode;
        duration?: number;
        pauseDuration: number;
        position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
        ariaProps: {
            role: 'status' | 'alert';
            'aria-live': 'assertive' | 'off' | 'polite';
        };
        style?: React.CSSProperties;
        className?: string;
        createdAt: number;
        visible: boolean;
        height?: number;
    }

    export interface ToasterProps {
        position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
        reverseOrder?: boolean;
        gutter?: number;
        containerStyle?: React.CSSProperties;
        containerClassName?: string;
        toastOptions?: {
            className?: string;
            duration?: number;
            style?: React.CSSProperties;
            success?: {
                duration?: number;
                style?: React.CSSProperties;
            };
            error?: {
                duration?: number;
                style?: React.CSSProperties;
            };
        };
        children?: (toast: Toast) => React.ReactNode;
    }

    export const Toaster: React.FC<ToasterProps>;

    export interface ToastOptions {
        id?: string;
        icon?: React.ReactNode;
        duration?: number;
        position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
        style?: React.CSSProperties;
        className?: string;
        iconTheme?: {
            primary?: string;
            secondary?: string;
        };
    }

    export interface ToastHandler {
        (message: string, options?: ToastOptions): string;
        success(message: string, options?: ToastOptions): string;
        error(message: string, options?: ToastOptions): string;
        loading(message: string, options?: ToastOptions): string;
        custom(component: React.ReactNode, options?: ToastOptions): string;
        dismiss(toastId?: string): void;
        remove(toastId?: string): void;
        promise<T>(
            promise: Promise<T>,
            msgs: {
                loading: React.ReactNode;
                success: React.ReactNode | ((data: T) => React.ReactNode);
                error: React.ReactNode | ((err: Error) => React.ReactNode);
            },
            options?: ToastOptions
        ): Promise<T>;
    }

    const toast: ToastHandler;
    export default toast;
}

declare module 'react-syntax-highlighter' {
    import * as React from 'react';

    export interface SyntaxHighlighterProps {
        language?: string;
        style?: { [key: string]: React.CSSProperties };
        children?: string | string[];
        customStyle?: React.CSSProperties;
        codeTagProps?: React.HTMLProps<HTMLElement>;
        useInlineStyles?: boolean;
        showLineNumbers?: boolean;
        showInlineLineNumbers?: boolean;
        startingLineNumber?: number;
        lineNumberContainerStyle?: React.CSSProperties;
        lineNumberStyle?: React.CSSProperties | ((lineNumber: number) => React.CSSProperties);
        wrapLines?: boolean;
        wrapLongLines?: boolean;
        lineProps?: React.HTMLProps<HTMLElement> | ((lineNumber: number) => React.HTMLProps<HTMLElement>);
        renderer?: (props: { rows: any[]; stylesheet: any; useInlineStyles: boolean }) => React.ReactNode;
        PreTag?: React.ComponentType<any> | string;
        CodeTag?: React.ComponentType<any> | string;
        [spread: string]: any;
    }

    export class SyntaxHighlighter extends React.Component<SyntaxHighlighterProps> {}
    export const Light: React.FC<SyntaxHighlighterProps>;
    export const Prism: React.FC<SyntaxHighlighterProps>;
    export default SyntaxHighlighter;
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism' {
    export const oneDark: { [key: string]: React.CSSProperties };
    export const oneLight: { [key: string]: React.CSSProperties };
    export const vscDarkPlus: { [key: string]: React.CSSProperties };
}

declare module 'react-syntax-highlighter/dist/esm/styles/hljs' {
    export const docco: { [key: string]: React.CSSProperties };
    export const github: { [key: string]: React.CSSProperties };
}

