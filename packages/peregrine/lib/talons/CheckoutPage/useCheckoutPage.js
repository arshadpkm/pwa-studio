import { useCallback, useState, useMemo } from 'react';
import {
    useApolloClient,
    useLazyQuery,
    useMutation,
    useQuery
} from '@apollo/react-hooks';

import { useAppContext } from '../../context/app';
import { useUserContext } from '../../context/user';
import { useCartContext } from '../../context/cart';
import { clearCartDataFromCache } from '../../Apollo/clearCartDataFromCache';

export const CHECKOUT_STEP = {
    SHIPPING_ADDRESS: 1,
    SHIPPING_METHOD: 2,
    PAYMENT: 3,
    REVIEW: 4
};

export const useCheckoutPage = props => {
    const {
        mutations: { createCartMutation, placeOrderMutation },
        queries: { getCheckoutDetailsQuery, getOrderDetailsQuery }
    } = props;

    const [reviewOrderButtonClicked, setReviewOrderButtonClicked] = useState(
        false
    );

    const apolloClient = useApolloClient();
    const [isUpdating, setIsUpdating] = useState(false);

    const [, { toggleDrawer }] = useAppContext();
    const [{ isSignedIn }] = useUserContext();
    const [{ cartId }, { createCart, removeCart }] = useCartContext();

    const [fetchCartId] = useMutation(createCartMutation);
    const [
        placeOrder,
        {
            data: placeOrderData,
            error: placeOrderError,
            loading: placeOrderLoading
        }
    ] = useMutation(placeOrderMutation);

    const [
        getOrderDetails,
        { data: orderDetailsData, loading: orderDetailsLoading }
    ] = useLazyQuery(getOrderDetailsQuery, {
        // We use this query to fetch details _just_ before submission, so we
        // want to make sure it is fresh. We also don't want to cache this data
        // because it may contain PII.
        fetchPolicy: 'network-only'
    });

    const {
        data: checkoutData,
        networkStatus: checkoutQueryNetworkStatus
    } = useQuery(getCheckoutDetailsQuery, {
        /**
         * Skip fetching checkout details if the `cartId`
         * is a falsy value.
         */
        skip: !cartId,
        notifyOnNetworkStatusChange: true,
        variables: {
            cartId
        }
    });

    /**
     * For more info about network statues check this out
     *
     * https://www.apollographql.com/docs/react/data/queries/#inspecting-loading-states
     */
    const isLoading = useMemo(
        () =>
            checkoutQueryNetworkStatus ? checkoutQueryNetworkStatus < 7 : true,
        [checkoutQueryNetworkStatus]
    );

    const checkoutStep = checkoutData && checkoutData.cart.checkoutStep;

    const setCheckoutStep = useCallback(
        step => {
            const { cart: previousCart } = apolloClient.readQuery({
                query: getCheckoutDetailsQuery
            });

            apolloClient.writeQuery({
                query: getCheckoutDetailsQuery,
                data: {
                    cart: {
                        ...previousCart,
                        checkoutStep: step
                    }
                }
            });
        },
        [apolloClient, getCheckoutDetailsQuery]
    );

    const handleSignIn = useCallback(() => {
        // TODO: set navigation state to "SIGN_IN". useNavigation:showSignIn doesn't work.
        toggleDrawer('nav');
    }, [toggleDrawer]);

    const handleReviewOrder = useCallback(() => {
        setReviewOrderButtonClicked(true);
    }, []);

    const resetReviewOrderButtonClicked = useCallback(() => {
        setReviewOrderButtonClicked(false);
    }, [setReviewOrderButtonClicked]);

    const setShippingInformationDone = useCallback(() => {
        if (checkoutStep === CHECKOUT_STEP.SHIPPING_ADDRESS) {
            setCheckoutStep(CHECKOUT_STEP.SHIPPING_METHOD);
        }
    }, [checkoutStep, setCheckoutStep]);

    const setShippingMethodDone = useCallback(() => {
        if (checkoutStep === CHECKOUT_STEP.SHIPPING_METHOD) {
            setCheckoutStep(CHECKOUT_STEP.PAYMENT);
        }
    }, [checkoutStep, setCheckoutStep]);

    const setPaymentInformationDone = useCallback(() => {
        if (checkoutStep === CHECKOUT_STEP.PAYMENT) {
            setCheckoutStep(CHECKOUT_STEP.REVIEW);
        }
    }, [checkoutStep, setCheckoutStep]);

    const handlePlaceOrder = useCallback(async () => {
        await getOrderDetails({
            variables: {
                cartId
            }
        });

        await placeOrder({
            variables: {
                cartId
            }
        });

        await removeCart();

        await clearCartDataFromCache(apolloClient);

        await createCart({
            fetchCartId
        });
    }, [
        apolloClient,
        cartId,
        createCart,
        fetchCartId,
        getOrderDetails,
        placeOrder,
        removeCart
    ]);

    return {
        checkoutStep,
        error: placeOrderError,
        handleSignIn,
        handlePlaceOrder,
        hasError: !!placeOrderError,
        isCartEmpty: !(checkoutData && checkoutData.cart.total_quantity),
        isGuestCheckout: !isSignedIn,
        isLoading,
        isUpdating,
        orderDetailsData,
        orderDetailsLoading,
        orderNumber:
            (placeOrderData && placeOrderData.placeOrder.order.order_number) ||
            null,
        placeOrderLoading,
        setIsUpdating,
        setShippingInformationDone,
        setShippingMethodDone,
        setPaymentInformationDone,
        resetReviewOrderButtonClicked,
        handleReviewOrder,
        reviewOrderButtonClicked
    };
};
