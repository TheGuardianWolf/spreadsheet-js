'use strict';

const init = async () => {
    document.addEventListener('DOMContentLoaded', () => {
        alert('test');
    });
};

const main = async () => {
    await init();
};

main();

